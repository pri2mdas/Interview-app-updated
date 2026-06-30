import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Cpu, Shield, GitBranch, Activity, Clock, Brain } from "lucide-react";
import Nav from "@/components/Nav";

const HERO_BG = "https://images.unsplash.com/photo-1518773553398-650c184e0bb3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA0MTJ8MHwxfHNlYXJjaHwyfHxjb2RlJTIwbmV0d29yayUyMG1hdHJpeCUyMGRhcmslMjBiYWNrZ3JvdW5kfGVufDB8fHx8MTc4MjE0OTM2OHww&ixlib=rb-4.1.0&q=85";

const FEATURES = [
  { icon: Brain, label: "AI_INTERVIEWER", desc: "Senior-level questioning powered by Claude Sonnet 4.5. Adapts difficulty and drills follow-ups in real time." },
  { icon: Cpu, label: "15+ TOOLS", desc: "AWS, Kubernetes, Terraform, Helm, ArgoCD, Docker, CI/CD, Vault, Istio, Prometheus and more." },
  { icon: Activity, label: "SCENARIO_MODE", desc: "Real production incident simulations: NotReady nodes, broken CI, leaked secrets, drift detection." },
  { icon: Shield, label: "DEVSECOPS", desc: "Security questions on SAST, DAST, SBOMs, supply-chain attacks, policy-as-code." },
  { icon: Clock, label: "60_MIN_SESSION", desc: "Full timed run with adaptive question count. Auto-ends and generates report." },
  { icon: GitBranch, label: "PER_TOPIC_MASTERY", desc: "Detailed breakdown showing strengths, gaps, and what to study next." },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative z-10 bg-white dark:bg-zinc-950">
      <Nav />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-0 dark:opacity-40"
          style={{ backgroundImage: `url(${HERO_BG})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/95 to-white dark:from-zinc-950/70 dark:via-zinc-950/85 dark:to-zinc-950" aria-hidden />
        <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />

        <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-32">
          <div className="max-w-4xl">
            <h1
              data-testid="hero-title"
              className="font-display font-black text-zinc-900 dark:text-zinc-50 text-4xl sm:text-5xl lg:text-7xl tracking-tighter leading-[0.95] fade-up"
              style={{ animationDelay: "0.05s" }}
            >
              Mock interviews
              <br />
              for <span className="text-green-600 dark:text-green-400">DevOps</span> &amp; <span className="text-green-600 dark:text-green-400">DevSecOps</span>
              <br />
              that <span className="italic font-light">actually feel real.</span>
            </h1>

            <p
              data-testid="hero-sub"
              className="mt-8 max-w-2xl font-mono-ui text-base sm:text-lg text-zinc-800 dark:text-white leading-relaxed fade-up"
              style={{ animationDelay: "0.15s" }}
            >
              60-minute timed sessions with an AI Staff Engineer interviewer. Scenario-based questions,
              relentless follow-ups, per-topic mastery reports. Built for engineers preparing for
              <span className="text-zinc-800 dark:text-zinc-200"> staff, senior, and platform </span> roles.
            </p>

            <div className="mt-12 flex flex-wrap items-center gap-4 fade-up" style={{ animationDelay: "0.25s" }}>
              <button
                data-testid="hero-cta-start"
                onClick={() => navigate("/setup")}
                className="group font-mono-ui text-sm uppercase tracking-[0.2em] bg-green-600 dark:bg-green-500 text-zinc-950 hover:bg-green-500 dark:hover:bg-green-400 px-7 py-4 rounded-sm font-bold transition-colors inline-flex items-center gap-3"
              >
                initiate_session()
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
              <button
                data-testid="hero-cta-history"
                onClick={() => navigate("/history")}
                className="font-mono-ui text-sm uppercase tracking-[0.2em] border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-700 dark:text-zinc-100 hover:border-green-600 dark:hover:border-green-500 hover:text-green-600 dark:text-green-400 px-7 py-4 rounded-sm transition-colors"
              >
                view_history
              </button>
            </div>

            <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-2xl fade-up" style={{ animationDelay: "0.35s" }}>
              {[
                { k: "60", u: "MIN_SESSION" },
                { k: "15+", u: "TOOLS_COVERED" },
                { k: "20+", u: "QUESTIONS" },
                { k: "AI", u: "INTERVIEWER" },
              ].map((s) => (
                <div key={s.u} className="border-l border-zinc-300 dark:border-zinc-700 pl-4">
                  <div className="font-display font-black text-3xl text-green-600 dark:text-green-400 leading-none">{s.k}</div>
                  <div className="font-mono-ui text-[10px] tracking-[0.25em] uppercase text-zinc-500 mt-2">{s.u}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE GRID (Bento) */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
          <div className="max-w-2xl">
            <div className="font-mono-ui text-[11px] tracking-[0.3em] uppercase text-green-600 dark:text-green-400 mb-3">// capabilities</div>
            <h2 className="font-display font-black text-zinc-900 dark:text-zinc-50 text-3xl sm:text-4xl lg:text-5xl tracking-tight">
              Engineered for serious prep.
            </h2>
          </div>
          <p className="font-mono-ui text-sm text-zinc-500 dark:text-zinc-800 dark:text-zinc-100 max-w-md">
            No generic question banks. Every interview is generated live, adapts to your answers, and probes weaknesses.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-200 dark:bg-zinc-800">
          {FEATURES.map((f, i) => (
            <div
              key={f.label}
              data-testid={`feature-${i}`}
              className="bg-white dark:bg-zinc-950 p-8 hover:bg-zinc-100 dark:bg-zinc-900 transition-colors group cursor-default"
            >
              <f.icon className="w-7 h-7 text-green-600 dark:text-green-400 mb-6" strokeWidth={1.5} />
              <div className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 mb-3">/ {String(i + 1).padStart(2, "0")}</div>
              <h3 className="font-display font-bold text-zinc-900 dark:text-zinc-50 text-xl mb-3 group-hover:text-green-600 dark:text-green-400 transition-colors">{f.label}</h3>
              <p className="text-zinc-800 dark:text-white text-base leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-7xl px-6 py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="font-mono-ui text-[11px] tracking-[0.3em] uppercase text-green-600 dark:text-green-400 mb-3">// ready</div>
            <h2 className="font-display font-black text-zinc-900 dark:text-zinc-50 text-4xl sm:text-5xl tracking-tight leading-[1.05]">
              Stop reading flashcards.
              <br />
              <span className="text-zinc-500">Run the </span>
              <span className="text-green-600 dark:text-green-400">real loop.</span>
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            <div className="border border-zinc-200 dark:border-zinc-800 p-6 bg-zinc-100 dark:bg-zinc-900/50">
              <div className="font-mono-ui text-xs text-zinc-500 mb-2">$ ./tmi --start</div>
              <div className="font-mono-ui text-sm text-green-600 dark:text-green-400 cursor-blink">connecting to interviewer </div>
            </div>
            <button
              data-testid="cta-bottom-start"
              onClick={() => navigate("/setup")}
              className="font-mono-ui text-sm uppercase tracking-[0.2em] bg-green-600 dark:bg-green-500 text-zinc-950 hover:bg-green-500 dark:hover:bg-green-400 px-7 py-4 rounded-sm font-bold transition-colors inline-flex items-center justify-center gap-3 w-full sm:w-auto"
            >
              initiate_session()
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 mx-auto max-w-7xl px-6 flex justify-between items-center">
        <div className="font-mono-ui text-xs text-zinc-700 dark:text-zinc-300">© TakeMyInterview — built for aspiring Devops engineers</div>
        <div className="font-mono-ui text-xs text-zinc-700 dark:text-zinc-300">Devloped by Pritam Das</div>
      </footer>
    </div>
  );
}
