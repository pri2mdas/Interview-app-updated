import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Nav from "@/components/Nav";
import { getTopics, startInterview } from "@/lib/api";
import { toast } from "sonner";
import {
  SiKubernetes, SiTerraform, SiHelm, SiArgo, SiDocker, SiJenkins,
  SiLinux, SiAnsible, SiPrometheus, SiSnyk, SiVault, SiIstio, SiCloudflare, SiGit
} from "react-icons/si";
import { FaAws } from "react-icons/fa";
import { Loader2, ArrowRight } from "lucide-react";

const ICONS = {
  SiAmazonaws: FaAws, SiKubernetes, SiTerraform, SiHelm, SiArgo, SiDocker,
  SiJenkins, SiLinux, SiAnsible, SiPrometheus, SiSnyk, SiVault, SiIstio, SiCloudflare, SiGit
};

const DIFFICULTIES = [
  { id: "junior", label: "junior", desc: "Fundamentals · 0-2 yrs" },
  { id: "mid", label: "mid", desc: "Architecture · 2-5 yrs" },
  { id: "senior", label: "senior", desc: "Staff / Platform · 5+ yrs" },
];

export default function Setup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [difficulty, setDifficulty] = useState("mid");
  const [mode, setMode] = useState("text");
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTopics().then(setTopics).catch(() => toast.error("Failed to load topics"));
    const saved = localStorage.getItem("candidate_name");
    if (saved) setName(saved);
  }, []);

  const toggleTopic = (id) => {
    setSelectedTopics((p) => (p.includes(id) ? p.filter((t) => t !== id) : [...p, id]));
  };

  const canStart = name.trim().length >= 2 && selectedTopics.length > 0 && !loading;

  const start = async () => {
    if (!canStart) return;
    setLoading(true);
    try {
      const topicNames = selectedTopics.map((id) => topics.find((t) => t.id === id)?.name).filter(Boolean);
      localStorage.setItem("candidate_name", name.trim());
      const res = await startInterview({
        candidate_name: name.trim(),
        topics: topicNames,
        difficulty,
        mode,
        duration_minutes: duration,
      });
      toast.success("Session initiated");
      navigate(`/interview/${res.session_id}`, { state: { initial: res } });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to start interview");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative z-10 bg-white dark:bg-zinc-950">
      <Nav />

      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-12">
          <div className="font-mono-ui text-[11px] tracking-[0.3em] uppercase text-green-600 dark:text-green-400 mb-3">// setup</div>
          <h1 className="font-display font-black text-zinc-900 dark:text-zinc-50 text-4xl sm:text-5xl tracking-tighter">Configure session</h1>
          <p className="font-mono-ui text-sm text-zinc-500 dark:text-zinc-800 dark:text-zinc-100 mt-3">Select your stack, difficulty, and mode. The interviewer will adapt.</p>
        </div>

        {/* Name */}
        <section className="mb-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/40 p-8">
          <label className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-3 block">candidate_name</label>
          <input
            data-testid="setup-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="enter your name"
            className="w-full bg-transparent border-b border-zinc-300 dark:border-zinc-700 focus:border-green-500 outline-none font-mono-ui text-2xl text-zinc-900 dark:text-zinc-50 py-3 placeholder:text-zinc-400 dark:text-zinc-700 transition-colors"
          />
        </section>

        {/* Topics */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <label className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500">topics [{selectedTopics.length} selected]</label>
            <button
              data-testid="setup-select-all-btn"
              onClick={() => setSelectedTopics(selectedTopics.length === topics.length ? [] : topics.map((t) => t.id))}
              className="font-mono-ui text-[10px] tracking-[0.25em] uppercase text-zinc-500 dark:text-zinc-800 dark:text-zinc-100 hover:text-green-600 dark:text-green-400 transition-colors"
            >
              {selectedTopics.length === topics.length ? "clear_all" : "select_all"}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-zinc-200 dark:bg-zinc-800">
            {topics.map((t) => {
              const Icon = ICONS[t.icon] || SiLinux;
              const active = selectedTopics.includes(t.id);
              return (
                <button
                  key={t.id}
                  data-testid={`topic-${t.id}`}
                  onClick={() => toggleTopic(t.id)}
                  className={`p-5 text-left transition-colors flex flex-col gap-3 ${
                    active ? "bg-zinc-100 dark:bg-zinc-900 border border-green-500 -m-px" : "bg-white dark:bg-zinc-950 hover:bg-zinc-100 dark:bg-zinc-900 border border-transparent -m-px"
                  }`}
                >
                  <Icon className={`w-6 h-6 ${active ? "text-green-600 dark:text-green-400" : "text-zinc-400 dark:text-zinc-700 dark:text-zinc-100"}`} />
                  <div>
                    <div className={`font-mono-ui text-sm ${active ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-800 dark:text-zinc-200"}`}>{t.name}</div>
                    {active && <div className="font-mono-ui text-[9px] tracking-[0.3em] uppercase text-green-600 dark:text-green-400 mt-2">selected</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Difficulty + Mode + Duration */}
        <section className="grid md:grid-cols-3 gap-px bg-zinc-200 dark:bg-zinc-800 mb-10">
          <div className="bg-white dark:bg-zinc-950 p-6">
            <label className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-4 block">difficulty</label>
            <div className="flex flex-col gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  data-testid={`difficulty-${d.id}`}
                  onClick={() => setDifficulty(d.id)}
                  className={`text-left p-3 border transition-colors ${
                    difficulty === d.id
                      ? "border-green-500 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
                      : "border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-800 dark:text-zinc-100 hover:border-zinc-400 dark:border-zinc-600 hover:text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  <div className="font-mono-ui text-sm">{d.label}</div>
                  <div className="font-mono-ui text-[10px] text-zinc-500 mt-1">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-950 p-6">
            <label className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-4 block">interaction_mode</label>
            <div className="flex flex-col gap-2">
              {[
                { id: "text", label: "text", desc: "Type your answers" },
                { id: "voice", label: "voice", desc: "Speak (mic required)" },
              ].map((m) => (
                <button
                  key={m.id}
                  data-testid={`mode-${m.id}`}
                  onClick={() => setMode(m.id)}
                  className={`text-left p-3 border transition-colors ${
                    mode === m.id
                      ? "border-green-500 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50"
                      : "border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-800 dark:text-zinc-100 hover:border-zinc-400 dark:border-zinc-600 hover:text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  <div className="font-mono-ui text-sm">{m.label}</div>
                  <div className="font-mono-ui text-[10px] text-zinc-500 mt-1">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-950 p-6">
            <label className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-4 block">
              duration: {duration}_min
            </label>
            <input
              data-testid="setup-duration-slider"
              type="range" min="15" max="90" step="5"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10))}
              className="w-full accent-green-500"
            />
            <div className="flex justify-between font-mono-ui text-[10px] text-zinc-500 mt-2">
              <span>15</span><span>60</span><span>90</span>
            </div>
            <div className="font-mono-ui text-[10px] text-zinc-500 mt-4 leading-relaxed">
              The session auto-ends at the limit and generates a full feedback report.
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-4 items-center">
          <button
            data-testid="setup-start-btn"
            onClick={start}
            disabled={!canStart}
            className="group font-mono-ui text-sm uppercase tracking-[0.2em] bg-green-600 dark:bg-green-500 text-zinc-950 hover:bg-green-500 dark:hover:bg-green-400 disabled:bg-zinc-200 dark:bg-zinc-800 disabled:text-zinc-700 dark:text-zinc-300 disabled:cursor-not-allowed px-7 py-4 rounded-sm font-bold transition-colors inline-flex items-center gap-3"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
            {loading ? "spinning_up..." : "begin_interview()"}
          </button>
          {!canStart && !loading && (
            <span className="font-mono-ui text-xs text-zinc-500">
              {name.trim().length < 2 ? "// enter name" : "// pick at least one topic"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
