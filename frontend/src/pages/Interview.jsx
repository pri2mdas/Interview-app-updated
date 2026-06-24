import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { submitAnswer, endInterview, getInterview, transcribeAudio } from "@/lib/api";
import { toast } from "sonner";
import { Mic, MicOff, Send, StopCircle, Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function Interview() {
  const { sessionId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [score, setScore] = useState({ running_avg: 0, total_answered: 0 });
  const [secondsLeft, setSecondsLeft] = useState(60 * 60);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [endDialog, setEndDialog] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const feedRef = useRef(null);
  const endRef = useRef(false);

  // Initialize session
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        let initData = state?.initial;
        let loaded;
        if (initData) {
          loaded = await getInterview(sessionId);
        } else {
          loaded = await getInterview(sessionId);
        }
        if (cancelled) return;
        setSession(loaded);
        setMessages(loaded.messages || []);

        // Determine current question
        const msgs = loaded.messages || [];
        const lastInterviewer = [...msgs].reverse().find((m) => m.role === "interviewer");
        if (lastInterviewer) {
          setCurrentQuestion({
            content: lastInterviewer.content,
            topic: lastInterviewer.topic,
            question_type: lastInterviewer.question_type,
            number: msgs.filter((m) => m.role === "interviewer").length,
          });
        }
        // Compute scores
        const scores = (loaded.scores || []);
        const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
        setScore({ running_avg: avg, total_answered: scores.length });

        // Timer
        const start = new Date(loaded.started_at).getTime();
        const total = (loaded.duration_minutes || 60) * 60;
        const elapsed = Math.floor((Date.now() - start) / 1000);
        setSecondsLeft(Math.max(0, total - elapsed));

        if (loaded.status === "completed") {
          navigate(`/report/${sessionId}`);
        }
      } catch (e) {
        toast.error("Could not load session");
      }
    }
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [sessionId]);

  // Tick timer
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1 && !endRef.current) {
          endRef.current = true;
          clearInterval(id);
          finalize(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [session]);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    const ansText = answer.trim();
    setAnswer("");
    // Optimistic candidate message
    setMessages((m) => [
      ...m,
      { role: "candidate", content: ansText, timestamp: new Date().toISOString() },
    ]);
    try {
      const res = await submitAnswer(sessionId, ansText);
      setMessages((m) => {
        const copy = [...m];
        // Patch last candidate with score
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "candidate") {
            copy[i] = { ...copy[i], score: res.score_for_previous, feedback: res.feedback_for_previous };
            break;
          }
        }
        copy.push({
          role: "interviewer",
          content: res.question,
          topic: res.topic,
          question_type: res.question_type,
          timestamp: new Date().toISOString(),
        });
        return copy;
      });
      setCurrentQuestion({
        content: res.question, topic: res.topic, question_type: res.question_type, number: res.question_number,
      });
      setScore({ running_avg: res.running_avg, total_answered: res.total_answered });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  };

  const finalize = async (auto = false) => {
    if (ending) return;
    setEnding(true);
    try {
      if (auto) toast.info("Time's up — generating report");
      else toast.info("Wrapping up — generating report");
      await endInterview(sessionId);
      navigate(`/report/${sessionId}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to generate report");
      setEnding(false);
    }
  };

  // Voice recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        try {
          const res = await transcribeAudio(blob);
          setAnswer((prev) => (prev ? prev + " " : "") + res.text);
          toast.success("Transcribed");
        } catch (e) {
          toast.error("Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      setRecording(true);
    } catch (e) {
      toast.error("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const lowTime = secondsLeft < 600;

  return (
    <div className="min-h-screen relative z-10 bg-white dark:bg-zinc-950 flex flex-col">
      {/* Top bar */}
      <header data-testid="interview-header" className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-[1600px] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 bg-green-600 dark:bg-green-500 rounded-full animate-pulse" />
            <div>
              <div className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500">live_session</div>
              <div className="font-mono-ui text-sm text-zinc-800 dark:text-zinc-200">{session?.candidate_name || "..."} · {session?.difficulty}</div>
            </div>
          </div>
          <button
            data-testid="end-interview-btn"
            onClick={() => setEndDialog(true)}
            disabled={ending}
            className="font-mono-ui text-xs uppercase tracking-[0.2em] border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-700 dark:text-zinc-300 hover:border-red-600 dark:hover:border-red-500 hover:text-red-600 dark:text-red-400 px-4 py-2 rounded-sm transition-colors inline-flex items-center gap-2"
          >
            <StopCircle className="w-4 h-4" /> end_session
          </button>
        </div>
      </header>

      <div className="flex-1 mx-auto max-w-[1600px] w-full px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-px bg-zinc-200 dark:bg-zinc-800">
        {/* LEFT: TERMINAL FEED */}
        <div className="bg-white dark:bg-zinc-950 flex flex-col min-h-[60vh]">
          <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 flex items-center justify-between">
            <span>interview_stdout</span>
            <span className="text-zinc-500 dark:text-zinc-600">~/sessions/{sessionId.slice(0, 8)}</span>
          </div>

          <div ref={feedRef} data-testid="interview-feed" className="flex-1 overflow-y-auto px-6 py-6 font-mono-ui text-sm space-y-5">
            {messages.map((m, i) => (
              <div key={i} className="leading-relaxed">
                {m.role === "interviewer" ? (
                  <div data-testid={`msg-int-${i}`}>
                    <div className="text-zinc-500 text-xs mb-1">
                      <span className="text-green-600 dark:text-green-400">root@ai</span>
                      <span className="text-zinc-500 dark:text-zinc-600">:</span>
                      <span className="text-blue-600 dark:text-blue-400">~</span>
                      <span className="text-zinc-500 dark:text-zinc-600">$ </span>
                      <span className="text-zinc-500">[{m.topic || "general"} / {m.question_type || "concept"}]</span>
                    </div>
                    <div className="text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap pl-2 border-l border-zinc-200 dark:border-zinc-800">{m.content}</div>
                  </div>
                ) : (
                  <div data-testid={`msg-cand-${i}`}>
                    <div className="text-zinc-500 text-xs mb-1 flex items-center gap-2">
                      <span className="text-amber-600 dark:text-amber-400">user@candidate</span>
                      <span className="text-zinc-500 dark:text-zinc-600">:</span>
                      <span className="text-blue-600 dark:text-blue-400">~</span>
                      <span className="text-zinc-500 dark:text-zinc-600">$ </span>
                      {m.score != null && (
                        <span className={`px-1.5 py-0.5 text-[10px] tracking-wider ${
                          m.score >= 7 ? "text-green-600 dark:text-green-400 bg-green-600/15 dark:bg-green-500/10" : m.score >= 4 ? "text-amber-600 dark:text-amber-400 bg-amber-600/15 dark:bg-amber-500/10" : "text-red-600 dark:text-red-400 bg-red-600/15 dark:bg-red-500/10"
                        }`}>SCORE {m.score}/10</span>
                      )}
                    </div>
                    <div className="text-zinc-400 dark:text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap pl-2 border-l border-zinc-200 dark:border-zinc-800">{m.content}</div>
                    {m.feedback && (
                      <div className="text-zinc-500 text-xs mt-1 pl-2 italic">// {m.feedback}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {submitting && (
              <div data-testid="thinking" className="text-green-600 dark:text-green-400 cursor-blink text-xs">root@ai:~$ thinking </div>
            )}
          </div>

          {/* INPUT */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950">
            <div className="flex items-start gap-3">
              <div className="font-mono-ui text-amber-600 dark:text-amber-400 text-sm pt-3">$</div>
              <textarea
                data-testid="answer-input"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
                }}
                placeholder={transcribing ? "transcribing..." : "type your answer  (cmd/ctrl + enter to send)"}
                rows={3}
                disabled={submitting || ending || transcribing}
                className="flex-1 bg-transparent border border-zinc-200 dark:border-zinc-800 focus:border-green-500 outline-none px-3 py-2 font-mono-ui text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:text-zinc-600 resize-none transition-colors"
              />
              <div className="flex flex-col gap-2">
                <button
                  data-testid={recording ? "stop-recording-btn" : "start-recording-btn"}
                  onClick={recording ? stopRecording : startRecording}
                  disabled={submitting || ending || transcribing}
                  className={`px-3 py-2 border rounded-sm transition-colors ${
                    recording
                      ? "border-red-500 text-red-600 dark:text-red-400 animate-pulse"
                      : "border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-600 dark:text-zinc-400 hover:border-green-600 dark:hover:border-green-500 hover:text-green-600 dark:text-green-400"
                  } disabled:opacity-40`}
                  title={recording ? "Stop recording" : "Record"}
                >
                  {transcribing ? <Loader2 className="w-5 h-5 animate-spin" /> : recording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                  data-testid="send-answer-btn"
                  onClick={send}
                  disabled={!answer.trim() || submitting || ending}
                  className="px-3 py-2 bg-green-600 dark:bg-green-500 text-zinc-950 hover:bg-green-500 dark:hover:bg-green-400 disabled:bg-zinc-200 dark:bg-zinc-800 disabled:text-zinc-500 dark:text-zinc-600 rounded-sm font-bold transition-colors"
                  title="Send (Cmd/Ctrl+Enter)"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: COMMAND CENTER */}
        <aside className="bg-white dark:bg-zinc-950 flex flex-col">
          <div className="border-b border-zinc-200 dark:border-zinc-800 p-6">
            <div className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-3">time_remaining</div>
            <div
              data-testid="timer"
              className={`font-mono-ui font-bold text-5xl tracking-tighter ${lowTime ? "text-red-500 glow-red" : "text-green-600 dark:text-green-400 glow-green"}`}
            >
              {formatTime(secondsLeft)}
            </div>
            <div className="font-mono-ui text-[10px] uppercase tracking-[0.25em] text-zinc-500 mt-2">
              {lowTime ? "// final stretch" : `// ${session?.duration_minutes || 60} min session`}
            </div>
          </div>

          <div className="border-b border-zinc-200 dark:border-zinc-800 p-6">
            <div className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-3">avg_score</div>
            <div className="flex items-baseline gap-2">
              <div data-testid="avg-score" className="font-mono-ui font-bold text-4xl text-zinc-900 dark:text-zinc-50">{score.running_avg.toFixed(1)}</div>
              <div className="font-mono-ui text-sm text-zinc-500">/ 10</div>
            </div>
            <div className="mt-3 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-sm overflow-hidden">
              <div
                className={`h-full transition-all ${score.running_avg >= 7 ? "bg-green-600 dark:bg-green-500" : score.running_avg >= 4 ? "bg-amber-600 dark:bg-amber-500" : "bg-red-600 dark:bg-red-500"}`}
                style={{ width: `${(score.running_avg / 10) * 100}%` }}
              />
            </div>
            <div className="font-mono-ui text-[10px] uppercase tracking-[0.25em] text-zinc-500 mt-2">
              answered: <span className="text-zinc-400 dark:text-zinc-700 dark:text-zinc-300">{score.total_answered}</span>
            </div>
          </div>

          <div className="border-b border-zinc-200 dark:border-zinc-800 p-6">
            <div className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-3">current_question</div>
            {currentQuestion && (
              <div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="font-mono-ui text-[10px] uppercase tracking-[0.2em] bg-green-600/15 dark:bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1">Q{currentQuestion.number}</span>
                  <span className="font-mono-ui text-[10px] uppercase tracking-[0.2em] border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-600 dark:text-zinc-400 px-2 py-1">{currentQuestion.topic}</span>
                  <span className="font-mono-ui text-[10px] uppercase tracking-[0.2em] border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-600 dark:text-zinc-400 px-2 py-1">{currentQuestion.question_type}</span>
                </div>
                <div data-testid="current-question" className="font-mono-ui text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">{currentQuestion.content}</div>
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-3">topics</div>
            <div className="flex flex-wrap gap-2">
              {session?.topics?.map((t) => (
                <span key={t} className="font-mono-ui text-[10px] uppercase tracking-[0.15em] border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-600 dark:text-zinc-400 px-2 py-1">{t}</span>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={endDialog} onOpenChange={setEndDialog}>
        <DialogContent className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" /> end_session?</DialogTitle>
            <DialogDescription className="font-mono-ui text-zinc-500 dark:text-zinc-600 dark:text-zinc-400 text-sm">
              This will close the interview and generate the final report. You cannot resume the session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              data-testid="end-cancel-btn"
              onClick={() => setEndDialog(false)}
              className="font-mono-ui text-xs uppercase tracking-[0.2em] border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:text-zinc-50 px-4 py-2 rounded-sm transition-colors"
            >
              cancel
            </button>
            <button
              data-testid="end-confirm-btn"
              onClick={() => { setEndDialog(false); finalize(false); }}
              disabled={ending}
              className="font-mono-ui text-xs uppercase tracking-[0.2em] bg-red-600 dark:bg-red-500 text-zinc-950 hover:bg-red-500 dark:hover:bg-red-400 px-4 py-2 rounded-sm font-bold transition-colors inline-flex items-center gap-2"
            >
              {ending ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
              end_and_generate
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
