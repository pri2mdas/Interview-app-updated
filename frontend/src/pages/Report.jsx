import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Nav from "@/components/Nav";
import { getInterview, endInterview } from "@/lib/api";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Loader2, Download, RotateCcw, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

function verdictColor(v = "") {
  const s = v.toLowerCase();
  if (s.includes("strong hire")) return "text-green-600 dark:text-green-400 border-green-500";
  if (s.includes("hire") && !s.includes("no")) return "text-green-600 dark:text-green-400 border-green-500";
  if (s.includes("lean")) return "text-amber-600 dark:text-amber-400 border-amber-500";
  return "text-red-600 dark:text-red-400 border-red-500";
}

export default function Report() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let s = await getInterview(sessionId);
        let report = s.final_report;
        // Defensive: Postgres stores final_report as a JSON string in some paths.
        if (typeof report === "string") {
          try { report = JSON.parse(report); } catch { report = null; }
        }
        if (s.status !== "completed" || !report) {
          const ended = await endInterview(sessionId);
          report = ended.report;
          if (typeof report === "string") {
            try { report = JSON.parse(report); } catch { report = null; }
          }
          s = await getInterview(sessionId);
        }
        if (cancelled) return;
        setSession(s);
        setReport(report);
      } catch (e) {
        toast.error("Failed to load report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen relative z-10 bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="font-mono-ui text-green-600 dark:text-green-400 cursor-blink">generating_report </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen relative z-10 bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="font-mono-ui text-zinc-500 dark:text-zinc-800 dark:text-zinc-100">No report available.</div>
      </div>
    );
  }

  const radarData = (report.topic_mastery || []).map((t) => ({ topic: t.topic, score: t.score }));
  const messages = session?.messages || [];

  return (
    <div className="min-h-screen relative z-10 bg-white dark:bg-zinc-950">
      <Nav />

      <div className="mx-auto max-w-7xl px-6 py-12 fade-up">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
          <div>
            <div className="font-mono-ui text-[11px] tracking-[0.3em] uppercase text-green-600 dark:text-green-400 mb-3">// session_complete</div>
            <h1 className="font-display font-black text-zinc-900 dark:text-zinc-50 text-4xl sm:text-5xl tracking-tighter">Feedback Report</h1>
            <p className="font-mono-ui text-sm text-zinc-500 dark:text-zinc-800 dark:text-zinc-100 mt-2">
              {session?.candidate_name} · {session?.difficulty} · {typeof session?.topics === "string" ? session.topics : (session?.topics || []).join(", ")}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              data-testid="report-history-btn"
              onClick={() => navigate("/history")}
              className="font-mono-ui text-xs uppercase tracking-[0.2em] border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-700 dark:text-zinc-100 hover:border-green-600 dark:hover:border-green-500 hover:text-green-600 dark:text-green-400 px-4 py-3 rounded-sm transition-colors"
            >
              view_history
            </button>
            <button
              data-testid="report-restart-btn"
              onClick={() => navigate("/setup")}
              className="font-mono-ui text-xs uppercase tracking-[0.2em] bg-green-600 dark:bg-green-500 text-zinc-950 hover:bg-green-500 dark:hover:bg-green-400 px-4 py-3 rounded-sm font-bold transition-colors inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> new_session
            </button>
          </div>
        </div>

        {/* Top scorecards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-200 dark:bg-zinc-800 mb-px">
          <div className="bg-white dark:bg-zinc-950 p-8">
            <div className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-3">overall_score</div>
            <div className="flex items-baseline gap-2">
              <div data-testid="report-overall-score" className="font-mono-ui font-bold text-6xl text-green-600 dark:text-green-400 glow-green tracking-tighter">{report.overall_score}</div>
              <div className="font-mono-ui text-xl text-zinc-500">/ 100</div>
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-950 p-8">
            <div className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-3">verdict</div>
            <div data-testid="report-verdict" className={`inline-block font-display font-black text-3xl border-l-4 pl-4 py-1 ${verdictColor(report.verdict)}`}>
              {report.verdict}
            </div>
            <div className="font-mono-ui text-xs text-zinc-500 mt-4">{report.next_level_readiness}</div>
          </div>
          <div className="bg-white dark:bg-zinc-950 p-8">
            <div className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-3">questions_answered</div>
            <div className="font-mono-ui font-bold text-6xl text-zinc-900 dark:text-zinc-50 tracking-tighter">
              {(session?.scores || []).length}
            </div>
            <div className="font-mono-ui text-[10px] uppercase tracking-[0.25em] text-zinc-500 mt-2">
              avg: <span className="text-green-600 dark:text-green-400">{(session?.scores || []).length ? ((session.scores.reduce((a, b) => a + b, 0)) / session.scores.length).toFixed(1) : 0}</span>/10
            </div>
          </div>
        </section>

        {/* Summary */}
        <section className="bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 border-t-0 p-8 mb-10">
          <div className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-3">// executive_summary</div>
          <p data-testid="report-summary" className="font-mono-ui text-base text-zinc-800 dark:text-zinc-200 leading-relaxed">{report.summary}</p>
        </section>

        {/* Mastery + Strengths/Weaknesses */}
        <section className="grid lg:grid-cols-2 gap-px bg-zinc-200 dark:bg-zinc-800 mb-10">
          <div className="bg-white dark:bg-zinc-950 p-8">
            <div className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-6">topic_mastery</div>
            {radarData.length >= 3 ? (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#27272a" />
                    <PolarAngleAxis dataKey="topic" tick={{ fill: "#a1a1aa", fontSize: 10, fontFamily: "JetBrains Mono" }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#52525b", fontSize: 9 }} stroke="#27272a" />
                    <Radar name="score" dataKey="score" stroke="#4ade80" fill="#4ade80" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="space-y-3">
                {radarData.map((t) => (
                  <div key={t.topic}>
                    <div className="flex justify-between font-mono-ui text-xs mb-1">
                      <span className="text-zinc-400 dark:text-zinc-700 dark:text-zinc-100">{t.topic}</span>
                      <span className="text-green-600 dark:text-green-400">{t.score}/100</span>
                    </div>
                    <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800">
                      <div className="h-full bg-green-600 dark:bg-green-500" style={{ width: `${t.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-zinc-950 p-8 space-y-6">
            <div>
              <div className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-green-600 dark:text-green-400 mb-3">+ strengths</div>
              <ul className="space-y-2" data-testid="report-strengths">
                {report.strengths?.map((s, i) => (
                  <li key={i} className="font-mono-ui text-sm text-zinc-800 dark:text-zinc-200 flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" /> {s}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-red-600 dark:text-red-400 mb-3">- weaknesses</div>
              <ul className="space-y-2" data-testid="report-weaknesses">
                {report.weaknesses?.map((s, i) => (
                  <li key={i} className="font-mono-ui text-sm text-zinc-800 dark:text-zinc-200 flex gap-2"><XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" /> {s}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Recommendations */}
        <section className="border border-zinc-200 dark:border-zinc-800 p-8 mb-10 bg-zinc-100 dark:bg-zinc-900/30">
          <div className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-4">// recommended_next_steps</div>
          <ol className="space-y-3" data-testid="report-recommendations">
            {report.recommendations?.map((r, i) => (
              <li key={i} className="font-mono-ui text-sm text-zinc-800 dark:text-zinc-200 flex gap-3">
                <span className="text-green-600 dark:text-green-400 font-bold">{String(i + 1).padStart(2, "0")}</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Topic mastery table */}
        <section className="border border-zinc-200 dark:border-zinc-800 mb-10">
          <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500">topic_breakdown</div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {report.topic_mastery?.map((t, i) => (
              <div key={i} className="grid grid-cols-12 px-6 py-4 gap-4 items-center hover:bg-zinc-100 dark:bg-zinc-900/50 transition-colors">
                <div className="col-span-3 font-mono-ui text-sm text-zinc-900 dark:text-zinc-100">{t.topic}</div>
                <div className="col-span-2 font-mono-ui text-sm">
                  <span className={t.score >= 70 ? "text-green-600 dark:text-green-400" : t.score >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}>{t.score}</span>
                  <span className="text-zinc-700 dark:text-zinc-300">/100</span>
                </div>
                <div className="col-span-7 font-mono-ui text-xs text-zinc-500 dark:text-zinc-800 dark:text-zinc-100">{t.notes}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Transcript */}
        <section className="border border-zinc-200 dark:border-zinc-800 mb-10">
          <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500">full_transcript</div>
          <div className="p-6 space-y-5 font-mono-ui text-sm max-h-[600px] overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i}>
                {m.role === "interviewer" ? (
                  <div>
                    <div className="text-zinc-500 text-xs mb-1">
                      <span className="text-green-600 dark:text-green-400">root@ai</span><span className="text-zinc-700 dark:text-zinc-300">:~$ </span>
                      <span>[{m.topic} / {m.question_type}]</span>
                    </div>
                    <div className="text-zinc-900 dark:text-zinc-100 pl-2 border-l border-zinc-200 dark:border-zinc-800">{m.content}</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-zinc-500 text-xs mb-1 flex items-center gap-2">
                      <span className="text-amber-600 dark:text-amber-400">user@candidate</span><span className="text-zinc-700 dark:text-zinc-300">:~$ </span>
                      {m.score != null && (
                        <span className={`px-1.5 py-0.5 text-[10px] ${m.score >= 7 ? "text-green-600 dark:text-green-400 bg-green-600/15 dark:bg-green-500/10" : m.score >= 4 ? "text-amber-600 dark:text-amber-400 bg-amber-600/15 dark:bg-amber-500/10" : "text-red-600 dark:text-red-400 bg-red-600/15 dark:bg-red-500/10"}`}>{m.score}/10</span>
                      )}
                    </div>
                    <div className="text-zinc-400 dark:text-zinc-700 dark:text-zinc-100 pl-2 border-l border-zinc-200 dark:border-zinc-800">{m.content}</div>
                    {m.feedback && <div className="text-zinc-500 text-xs italic mt-1 pl-2">// {m.feedback}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <button
          data-testid="report-restart-bottom-btn"
          onClick={() => navigate("/setup")}
          className="font-mono-ui text-sm uppercase tracking-[0.2em] bg-green-600 dark:bg-green-500 text-zinc-950 hover:bg-green-500 dark:hover:bg-green-400 px-7 py-4 rounded-sm font-bold transition-colors inline-flex items-center gap-3"
        >
          run_another() <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
