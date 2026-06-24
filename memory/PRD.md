# OPSGRID — DevOps/DevSecOps Mock Interview Platform

## Original Problem Statement
Build a production-grade mock interview platform for tech interviews on DevOps/DevSecOps including all tools (AWS, Kubernetes, Terraform, Helm, ArgoCD, etc.). Candidate can take a 1-hour interview. The interviewer is AI, asks follow-up and scenario-based questions like a real interviewer.

## User Choices
- AI model: Emergent Universal LLM Key (Claude Sonnet 4.5 — claude-sonnet-4-5-20250929)
- Mode: Both text + voice (Whisper for STT)
- Auth: None (candidate just enters name)
- Features: Topic selection, difficulty levels, real-time scoring, full feedback report, scenario + follow-up questions, history dashboard
- Session: 60-min timer, adaptive number of questions

## Architecture
- Frontend: React 19 + Tailwind + shadcn/ui + react-icons + recharts. Dark "Retro-Futurism / Swiss High-Contrast" terminal aesthetic.
- Backend: FastAPI + Motor (MongoDB) + emergentintegrations.
- LLM: Claude Sonnet 4.5 via Emergent universal key. Whisper-1 for STT.
- Storage: Mongo `interviews` collection (no auth, no user accounts).

## v1 Implemented (Feb 2026)
- Landing page (hero, bento features, CTAs)
- Setup page (name, 15 topics, 3 difficulties, text/voice mode, 15-90 min duration)
- Live interview room (terminal feed, timer w/ low-time glow, side command center, score, current question)
- Text + voice answering (MediaRecorder → /api/voice/transcribe → Whisper)
- AI interviewer returns structured JSON (question + score + feedback + type + topic)
- End session → final report (overall score, verdict, strengths, weaknesses, topic-mastery radar, recommendations, transcript)
- History dashboard (filter by candidate name, click to view report)

## Backend Endpoints (all /api prefix)
- GET /topics
- POST /interview/start
- POST /interview/answer
- POST /interview/end/{session_id}
- GET /interview/{session_id}
- GET /interviews?candidate_name=
- POST /voice/transcribe

## Backlog (P1/P2)
- P1: Persisting topic mastery across sessions for trend lines
- P1: Auto-resume incomplete sessions
- P1: TTS (interviewer voice) using OpenAI TTS
- P2: Auth (Google OAuth) + shareable report URLs
- P2: PDF export of report
- P2: Custom company-specific interview templates (FAANG / SRE / Platform)
- P2: Pair-coding scenario screen with code editor
