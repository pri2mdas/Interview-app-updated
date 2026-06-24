import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Nav from "@/components/Nav";
import { listInterviews } from "@/lib/api";
import { Loader2, ChevronRight, Clock } from "lucide-react";

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const name = localStorage.getItem("candidate_name") || "";
    setFilter(name);
    listInterviews(name || undefined)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  const refilter = (n) => {
    setFilter(n);
    setLoading(true);
    listInterviews(n || undefined).then(setSessions).finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen relative z-10 bg-white dark:bg-zinc-950">
      <Nav />

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-wrap justify-between items-end gap-6 mb-10">
          <div>
            <div className="font-mono-ui text-[11px] tracking-[0.3em] uppercase text-green-600 dark:text-green-400 mb-3">// archive</div>
            <h1 className="font-display font-black text-zinc-900 dark:text-zinc-50 text-4xl sm:text-5xl tracking-tighter">Session History</h1>
            <p className="font-mono-ui text-sm text-zinc-500 dark:text-zinc-800 dark:text-zinc-100 mt-2">All past interviews. Click any row to view the full report.</p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500">filter_by_name</label>
            <input
              data-testid="history-filter"
              value={filter}
              onChange={(e) => refilter(e.target.value)}
              placeholder="all candidates"
              className="bg-transparent border-b border-zinc-300 dark:border-zinc-700 focus:border-green-500 outline-none font-mono-ui text-sm text-zinc-900 dark:text-zinc-100 py-2 px-1 placeholder:text-zinc-700 dark:text-zinc-300 transition-colors min-w-[240px]"
            />
          </div>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800">
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500">
            <div className="col-span-3">date</div>
            <div className="col-span-2">candidate</div>
            <div className="col-span-3">topics</div>
            <div className="col-span-1">difficulty</div>
            <div className="col-span-2">status</div>
            <div className="col-span-1 text-right">score</div>
          </div>

          {loading ? (
            <div className="px-6 py-12 flex items-center justify-center font-mono-ui text-sm text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> loading_archive
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-6 py-16 text-center" data-testid="history-empty">
              <div className="font-mono-ui text-sm text-zinc-500 mb-4">// no sessions found</div>
              <button
                onClick={() => navigate("/setup")}
                data-testid="history-empty-start-btn"
                className="font-mono-ui text-xs uppercase tracking-[0.2em] bg-green-600 dark:bg-green-500 text-zinc-950 hover:bg-green-500 dark:hover:bg-green-400 px-4 py-2 rounded-sm font-bold transition-colors"
              >
                start_first_session
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sessions.map((s) => {
                const avg = s.scores?.length ? Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 10) / 10 : 0;
                const overall = s.final_report?.overall_score;
                return (
                  <button
                    key={s.id}
                    data-testid={`history-row-${s.id}`}
                    onClick={() => navigate(s.status === "completed" ? `/report/${s.id}` : `/interview/${s.id}`)}
                    className="w-full grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-zinc-100 dark:bg-zinc-900/60 transition-colors text-left group"
                  >
                    <div className="col-span-3 font-mono-ui text-xs text-zinc-400 dark:text-zinc-700 dark:text-zinc-100 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" /> {formatDate(s.started_at)}
                    </div>
                    <div className="col-span-2 font-mono-ui text-sm text-zinc-900 dark:text-zinc-100">{s.candidate_name}</div>
                    <div className="col-span-3 font-mono-ui text-xs text-zinc-500 dark:text-zinc-800 dark:text-zinc-100 truncate">{(s.topics || []).join(", ")}</div>
                    <div className="col-span-1 font-mono-ui text-xs uppercase tracking-wider text-zinc-400 dark:text-zinc-700 dark:text-zinc-100">{s.difficulty}</div>
                    <div className="col-span-2">
                      <span className={`font-mono-ui text-[10px] uppercase tracking-[0.2em] px-2 py-1 ${s.status === "completed" ? "bg-green-600/15 dark:bg-green-500/10 text-green-600 dark:text-green-400" : "bg-amber-600/15 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
                        {s.status}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-2">
                      <span className={`font-mono-ui font-bold text-base ${overall >= 70 ? "text-green-600 dark:text-green-400" : overall >= 40 ? "text-amber-600 dark:text-amber-400" : overall != null ? "text-red-600 dark:text-red-400" : "text-zinc-500"}`}>
                        {overall != null ? overall : avg ? `${avg}/10` : "—"}
                      </span>
                      <ChevronRight className="w-4 h-4 text-zinc-700 dark:text-zinc-300 group-hover:text-green-600 dark:text-green-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
