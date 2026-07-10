from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import json
import re
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone

from database import init_db, cursor, get_user_by_email, get_user_by_username
from auth import (
    RegisterRequest, LoginRequest, UserPublic,
    hash_password, verify_password, create_access_token,
    get_current_user, get_optional_user, user_to_public,
)
import database

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Interview sessions live in PostgreSQL — no process-local cache needed,
# so any backend replica can resume a session that started on another pod.

GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
MODEL_NAME = "gemini-3.1-flash-lite"


app = FastAPI(title="DevOps Mock Interview Platform")
api_router = APIRouter(prefix="/api")


@app.on_event("startup")
def _startup() -> None:
    init_db()
    logger.info("PostgreSQL DB schema ready")


# ---------- Models ----------
class StartInterviewRequest(BaseModel):
    candidate_name: str
    topics: List[str]
    difficulty: Literal["junior", "mid", "senior"]
    mode: Literal["text", "voice"] = "text"
    duration_minutes: int = 60


class AnswerRequest(BaseModel):
    session_id: str
    answer: str


class Message(BaseModel):
    role: Literal["interviewer", "candidate", "system"]
    content: str
    timestamp: str
    score: Optional[int] = None
    feedback: Optional[str] = None
    question_type: Optional[str] = None
    topic: Optional[str] = None


class InterviewSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    candidate_name: str
    topics: List[str]
    difficulty: str
    mode: str
    duration_minutes: int
    started_at: str
    ended_at: Optional[str] = None
    status: Literal["active", "completed"] = "active"
    messages: List[Message] = []
    scores: List[int] = []
    final_report: Optional[dict] = None


# ---------- Prompts ----------
def build_system_prompt(topics: List[str], difficulty: str, candidate_name: str) -> str:
    topic_list = ", ".join(topics)
    return f"""You are an EXPERT senior DevOps/DevSecOps interviewer conducting a 1-hour technical interview with {candidate_name}.

INTERVIEW PARAMETERS:
- Topics: {topic_list}
- Difficulty: {difficulty}
- Duration: ~60 minutes, expect 15-25 questions

ROLE & PERSONALITY:
- Professional, direct, and probing - like a real Staff Engineer interviewer at a top tech company.
- Mix conceptual, hands-on, scenario-based, and follow-up questions.
- Adapt depth to candidate's previous answer (if they answered well, go deeper; if weak, simplify or pivot).
- Cover ALL selected topics fairly across the session.
- For scenarios: present realistic production incidents (e.g., "Your EKS cluster nodes are NotReady, walk me through your debugging").
- For follow-ups: drill into "why", "what if scale 10x", "what about security", "what could go wrong".

DIFFICULTY GUIDELINES:
- junior: Fundamentals, definitions, basic commands, simple troubleshooting.
- mid: Architecture decisions, multi-service troubleshooting, IaC patterns, CI/CD pipelines.
- senior: System design, large-scale failures, cost/security trade-offs, custom controllers, policy enforcement, multi-cloud.

SCORING (0-10):
- 0-3: Wrong/missing fundamentals
- 4-6: Partial / surface level
- 7-8: Solid answer, missing some depth
- 9-10: Exceptional, demonstrates senior-level mastery

CRITICAL OUTPUT FORMAT:
You MUST respond ONLY with a single valid JSON object, no preamble, no markdown fences. Schema:
{{
  "question": "<the next question to ask the candidate>",
  "question_type": "concept" | "scenario" | "follow_up" | "deep_dive",
  "topic": "<one of the selected topics>",
  "score_for_previous": <int 0-10 or null if this is the first question>,
  "feedback_for_previous": "<one short sentence on what was good/missing, or null on first turn>",
  "is_final": false
}}

RULES:
- ONE question per turn. No multi-part essays.
- Never break character. Never reveal you are an AI. Never reveal scores to the candidate (scores are internal).
- The "question" field is what the candidate sees - keep it conversational and natural.
- On the very first turn, score_for_previous and feedback_for_previous MUST be null.
- Vary question_type. Aim for ~40% scenario/follow-up to test real-world skill.
- If the candidate says "skip" or "I don't know", briefly acknowledge then move to a different angle or topic.
"""


def build_report_prompt() -> str:
    return """You are reviewing a completed DevOps/DevSecOps mock interview. Generate a comprehensive feedback report.

OUTPUT ONLY a single valid JSON object, no markdown fences:
{
  "overall_score": <int 0-100>,
  "verdict": "<one of: 'Strong Hire', 'Hire', 'Lean Hire', 'No Hire', 'Strong No Hire'>",
  "summary": "<2-3 sentence executive summary>",
  "strengths": ["<bullet>", "<bullet>", "<bullet>"],
  "weaknesses": ["<bullet>", "<bullet>", "<bullet>"],
  "topic_mastery": [
    {"topic": "<name>", "score": <int 0-100>, "notes": "<short>"}
  ],
  "recommendations": ["<actionable next step>", "<bullet>", "<bullet>"],
  "next_level_readiness": "<short text e.g. 'Ready for Mid-level DevOps roles'>"
}

Be objective, technical, and constructive. Cite specific topics from the transcript.
"""


# ---------- Helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def extract_json(text: str) -> dict:
    """Robustly extract JSON object from LLM response."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def _parse_report(report) -> Optional[dict]:
    """Normalise a final_report value from the DB (JSON string or dict) to a dict."""
    if not report:
        return None
    if isinstance(report, str):
        try:
            return json.loads(report)
        except Exception:
            return None
    return report


async def call_interviewer(session_id: str, system_prompt: str, user_text: str) -> dict:

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"{system_prompt}\n\n{user_text}"
                    }
                ]
            }
        ]
    }

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent",
            headers={
                "Content-Type": "application/json",
                "X-goog-api-key": GEMINI_API_KEY,
            },
            json=payload,
        )

    response.raise_for_status()

    result = response.json()

    text = result["candidates"][0]["content"]["parts"][0]["text"]

    return extract_json(text)


async def call_reporter(
    session_id: str,
    transcript: str,
    topics: List[str],
    difficulty: str,
) -> dict:

    user_text = (
        f"Topics: {', '.join(topics)}\n"
        f"Difficulty: {difficulty}\n\n"
        f"FULL TRANSCRIPT:\n{transcript}\n\n"
        "Generate the report."
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"{build_report_prompt()}\n\n{user_text}"
                    }
                ]
            }
        ]
    }

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent",
            headers={
                "Content-Type": "application/json",
                "X-goog-api-key": GEMINI_API_KEY,
            },
            json=payload,
        )

    response.raise_for_status()

    result = response.json()

    text = result["candidates"][0]["content"]["parts"][0]["text"]

    return extract_json(text)


def messages_to_transcript(messages: List[dict]) -> str:
    lines = []
    for m in messages:
        role = m.get("role")
        if role == "interviewer":
            lines.append(f"INTERVIEWER [{m.get('topic','?')} / {m.get('question_type','?')}]: {m['content']}")
        elif role == "candidate":
            score = m.get("score")
            lines.append(f"CANDIDATE (score={score}): {m['content']}")
    return "\n\n".join(lines)


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"service": "DevOps Mock Interview Platform", "status": "ok"}


# ── Auth ──────────────────────────────────────────────────────────────────────
@api_router.post("/auth/register", response_model=dict)
async def register(req: RegisterRequest):
    email = req.email.strip().lower()
    username = req.username.strip()
    full_name = req.full_name.strip()
    password = req.password

    # basic validation
    if "@" not in email or "." not in email or len(email) < 5:
        raise HTTPException(400, "Invalid email")
    if len(username) < 3 or not re.match(r"^[A-Za-z0-9_.-]+$", username):
        raise HTTPException(400, "Username must be 3+ chars (letters, numbers, _ . -)")
    if len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if not full_name:
        raise HTTPException(400, "Full name required")

    if get_user_by_email(email) is not None:
        raise HTTPException(409, "An account with that email already exists")
    if get_user_by_username(username) is not None:
        raise HTTPException(409, "That username is already taken")

    user_id = database.create_user(
        email=email,
        username=username,
        password_hash=hash_password(password),
        full_name=full_name,
        created_at=now_iso(),
    )
    user_row = database.get_user_by_id(user_id)
    token = create_access_token(user_id, username)
    return {"token": token, "user": user_to_public(user_row).model_dump()}


@api_router.post("/auth/login", response_model=dict)
async def login(req: LoginRequest):
    identifier = req.identifier.strip()
    password = req.password
    if not identifier or not password:
        raise HTTPException(400, "Identifier and password required")

    user = get_user_by_email(identifier.lower()) if "@" in identifier else get_user_by_username(identifier)
    if user is None or not verify_password(password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    token = create_access_token(user["id"], user["username"])
    return {"token": token, "user": user_to_public(user).model_dump()}


@api_router.get("/auth/me", response_model=UserPublic)
async def me(user=Depends(get_current_user)):
    return user_to_public(user)


@api_router.get("/topics")
async def get_topics():
    return {
        "topics": [
            {"id": "aws",        "name": "AWS",                           "icon": "SiAmazonaws"},
            {"id": "kubernetes", "name": "Kubernetes",                    "icon": "SiKubernetes"},
            {"id": "terraform",  "name": "Terraform",                     "icon": "SiTerraform"},
            {"id": "helm",       "name": "Helm",                          "icon": "SiHelm"},
            {"id": "argocd",     "name": "ArgoCD",                        "icon": "SiArgo"},
            {"id": "docker",     "name": "Docker",                        "icon": "SiDocker"},
            {"id": "ci_cd",      "name": "CI/CD (Jenkins, GitHub Actions)","icon": "SiJenkins"},
            {"id": "linux",      "name": "Linux & Shell",                 "icon": "SiLinux"},
            {"id": "ansible",    "name": "Ansible",                       "icon": "SiAnsible"},
            {"id": "prometheus", "name": "Prometheus / Grafana",          "icon": "SiPrometheus"},
            {"id": "devsecops",  "name": "DevSecOps (SAST, DAST, SBOM)", "icon": "SiSnyk"},
            {"id": "vault",      "name": "HashiCorp Vault",               "icon": "SiVault"},
            {"id": "istio",      "name": "Service Mesh (Istio)",          "icon": "SiIstio"},
            {"id": "networking", "name": "Cloud Networking",              "icon": "SiCloudflare"},
            {"id": "gitops",     "name": "GitOps",                        "icon": "SiGit"},
        ]
    }


@api_router.post("/interview/start")
async def start_interview(req: StartInterviewRequest, user=Depends(get_optional_user)):
    if not req.topics:
        raise HTTPException(400, "At least one topic required")
    if not req.candidate_name.strip():
        raise HTTPException(400, "candidate_name required")

    user_id = user["id"] if user is not None else None

    session_id = str(uuid.uuid4())
    system_prompt = build_system_prompt(req.topics, req.difficulty, req.candidate_name)

    try:
        first = await call_interviewer(
            session_id,
            system_prompt,
            f"Begin the interview now. The candidate is {req.candidate_name}. "
            "Ask the FIRST question (warm-up but still technical). "
            "Remember: score_for_previous and feedback_for_previous must be null on this first turn.",
        )
    except Exception as e:
        logger.exception("LLM start failed")
        raise HTTPException(500, f"Failed to start interview: {e}")

    first_msg = Message(
        role="interviewer",
        content=first.get("question", ""),
        timestamp=now_iso(),
        question_type=first.get("question_type"),
        topic=first.get("topic"),
    )

    session = InterviewSession(
        id=session_id,
        candidate_name=req.candidate_name.strip(),
        topics=req.topics,
        difficulty=req.difficulty,
        mode=req.mode,
        duration_minutes=req.duration_minutes,
        started_at=now_iso(),
        messages=[first_msg],
    )

    # Persist metadata AND live state to PostgreSQL in one shot. Any backend
    # replica can now resume this session via database.get_interview().
    database.create_interview(
        session_id=session_id,
        user_id=user_id,
        candidate_name=session.candidate_name,
        topics=",".join(session.topics),
        difficulty=session.difficulty,
        mode=session.mode,
        duration_minutes=session.duration_minutes,
        started_at=session.started_at,
        messages=[first_msg.model_dump()],
        scores=[],
        system_prompt=system_prompt,
    )

    return {
        "session_id": session_id,
        "candidate_name": session.candidate_name,
        "topics": session.topics,
        "difficulty": session.difficulty,
        "duration_minutes": session.duration_minutes,
        "started_at": session.started_at,
        "question": first_msg.content,
        "question_type": first_msg.question_type,
        "topic": first_msg.topic,
        "question_number": 1,
    }


@api_router.post("/interview/answer")
async def submit_answer(req: AnswerRequest):
    doc = database.get_interview(req.session_id)  # ← read from Postgres
    if not doc:
        raise HTTPException(404, "Session not found")
    if doc.get("status") == "completed":
        raise HTTPException(400, "Session already completed")

    system_prompt = doc["system_prompt"]
    messages = doc.get("messages") or []
    scores = doc.get("scores") or []

    candidate_msg = {
        "role": "candidate",
        "content": req.answer,
        "timestamp": now_iso(),
        "score": None,
        "feedback": None,
        "question_type": None,
        "topic": None,
    }
    messages.append(candidate_msg)

    history = []
    for m in messages:
        if m["role"] == "interviewer":
            history.append(f"INTERVIEWER: {m['content']}")
        elif m["role"] == "candidate":
            history.append(f"CANDIDATE: {m['content']}")
    context = "\n\n".join(history)

    user_text = (
        f"Conversation so far:\n\n{context}\n\n"
        "Score the candidate's most recent answer (score_for_previous) and provide brief "
        "feedback_for_previous, then ask the NEXT question. "
        "Respond with ONLY the JSON object per schema."
    )

    try:
        turn = await call_interviewer(req.session_id, system_prompt, user_text)
    except Exception as e:
        logger.exception("LLM answer failed")
        raise HTTPException(500, f"Interviewer failed: {e}")

    score = turn.get("score_for_previous")
    feedback = turn.get("feedback_for_previous")

    if score is not None:
        candidate_msg["score"] = int(score)
        candidate_msg["feedback"] = feedback
        scores.append(int(score))

    next_question = turn.get("question", "")
    interviewer_msg = {
        "role": "interviewer",
        "content": next_question,
        "timestamp": now_iso(),
        "score": None,
        "feedback": None,
        "question_type": turn.get("question_type"),
        "topic": turn.get("topic"),
    }
    messages.append(interviewer_msg)

    database.update_interview_messages(req.session_id, messages, scores)

    avg_score = round(sum(scores) / len(scores), 1) if scores else 0
    question_number = sum(1 for m in messages if m["role"] == "interviewer")

    return {
        "session_id": req.session_id,
        "score_for_previous": score,
        "feedback_for_previous": feedback,
        "running_avg": avg_score,
        "total_answered": len(scores),
        "question": next_question,
        "question_type": interviewer_msg["question_type"],
        "topic": interviewer_msg["topic"],
        "question_number": question_number,
    }


@api_router.post("/interview/end/{session_id}")
async def end_interview(session_id: str):
    doc = database.get_interview(session_id)    # ← read from Postgres
    if not doc:
        raise HTTPException(404, "Session not found")
    if doc.get("status") == "completed" and doc.get("final_report"):
        cached = doc["final_report"]
        if isinstance(cached, str):
            try:
                cached = json.loads(cached)
            except Exception:
                pass
        return {"session_id": session_id, "report": cached}

    messages = doc.get("messages") or []
    transcript = messages_to_transcript(messages)
    if not transcript.strip():
        raise HTTPException(400, "No transcript to evaluate")

    # topics is stored comma-separated in the DB; the reporter wants a list.
    topic_list = [t for t in (doc.get("topics") or "").split(",") if t]

    try:
        report = await call_reporter(session_id, transcript, topic_list, doc["difficulty"])
    except Exception as e:
        logger.exception("Report generation failed")
        raise HTTPException(500, f"Report failed: {e}")

    ended_at = now_iso()
    database.update_interview_completion(session_id, ended_at, report)

    return {"session_id": session_id, "report": report}


@api_router.get("/interview/{session_id}")
async def get_interview(session_id: str):
    doc = database.get_interview(session_id)    # ← read from Postgres
    if not doc:
        raise HTTPException(404, "Session not found")
    # final_report is stored as a JSON string in Postgres; return it parsed.
    doc["final_report"] = _parse_report(doc.get("final_report"))
    # Don't leak the system prompt to the client.
    return {k: v for k, v in doc.items() if k != "system_prompt"}


@api_router.get("/interviews")
async def list_interviews(
    candidate_name: Optional[str] = None,
    limit: int = 50,
    user=Depends(get_optional_user),
):
    # Everything lives in Postgres now — authenticated users see only their
    # own sessions; anonymous users see the (user_id IS NULL) bucket that
    # captures all sessions started without a token.
    items: list[dict] = []
    with cursor() as c:
        if user is not None:
            c.execute(
                "SELECT session_id, candidate_name, topics, difficulty, mode, duration_minutes, "
                "started_at, ended_at, status, final_report "
                "FROM interviews WHERE user_id = %s ORDER BY started_at DESC LIMIT %s",
                (user["id"], limit),
            )
        else:
            c.execute(
                "SELECT session_id, candidate_name, topics, difficulty, mode, duration_minutes, "
                "started_at, ended_at, status, final_report "
                "FROM interviews WHERE user_id IS NULL ORDER BY started_at DESC LIMIT %s",
                (limit,),
            )
        rows = c.fetchall()

    for row in rows:
        if candidate_name and row["candidate_name"] != candidate_name:
            continue
        topics = [t for t in (row["topics"] or "").split(",") if t]
        report = None
        if row["final_report"]:
            if isinstance(row["final_report"], str):
                try:
                    report = json.loads(row["final_report"])
                except Exception:
                    report = None
            else:
                report = row["final_report"]
        items.append({
            "id": row["session_id"],
            "candidate_name": row["candidate_name"],
            "topics": topics,
            "difficulty": row["difficulty"],
            "mode": row["mode"],
            "duration_minutes": row["duration_minutes"],
            "started_at": row["started_at"],
            "ended_at": row["ended_at"],
            "status": row["status"],
            "final_report": report,
        })
    return {"sessions": items}


@api_router.post("/voice/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(400, "Audio file too large (max 25 MB)")
    if len(data) < 200:
        raise HTTPException(400, "Audio too short")

    content_type = file.content_type or "audio/webm"

    try:
        audio_part = types.Part(
            inline_data=types.Blob(
                mime_type=content_type,
                data=data,
            )
        )
        prompt = (
            "Transcribe this audio recording exactly as spoken. "
            "This is a technical DevOps and DevSecOps interview discussing AWS, "
            "Kubernetes, Terraform, Helm, ArgoCD, Docker, CI/CD, security, and infrastructure. "
            "Return ONLY the transcribed text — no commentary, no timestamps."
        )
        response = await gemini_client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=[audio_part, prompt],
        )
        return {"text": response.text.strip()}
    except Exception as e:
        logger.exception("STT failed")
        raise HTTPException(500, f"Transcription failed: {e}")


# ---------- App setup ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=7000, reload=True)