import { Link, useNavigate } from "react-router-dom";
import { Terminal, History as HistoryIcon } from "lucide-react";

export default function Nav({ minimal = false }) {
  const navigate = useNavigate();
  return (
    <header
      data-testid="app-header"
      className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link
          to="/"
          data-testid="brand-link"
          className="flex items-center gap-3 group"
        >
          <div className="w-8 h-8 grid place-items-center bg-green-500 text-zinc-950 rounded-sm group-hover:bg-green-400 transition-colors">
            <Terminal className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display font-black text-zinc-50 text-base tracking-tight">OPSGRID</span>
            <span className="font-mono-ui text-[10px] tracking-[0.25em] text-zinc-500 uppercase">mock_interview.sh</span>
          </div>
        </Link>

        {!minimal && (
          <nav className="flex items-center gap-1">
            <button
              data-testid="nav-history-btn"
              onClick={() => navigate("/history")}
              className="font-mono-ui text-xs uppercase tracking-[0.2em] text-zinc-400 hover:text-green-400 px-3 py-2 transition-colors flex items-center gap-2"
            >
              <HistoryIcon className="w-4 h-4" /> history
            </button>
            <button
              data-testid="nav-start-btn"
              onClick={() => navigate("/setup")}
              className="font-mono-ui text-xs uppercase tracking-[0.2em] bg-green-500 text-zinc-950 hover:bg-green-400 px-4 py-2 rounded-sm font-bold transition-colors"
            >
              start_interview
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
