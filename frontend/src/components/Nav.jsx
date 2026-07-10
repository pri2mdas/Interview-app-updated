import { Link, useNavigate } from "react-router-dom";
import {
  Terminal, History as HistoryIcon, Sun, Moon,
  LogIn, UserPlus, LogOut, User, ChevronDown,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";

export default function Nav({ minimal = false }) {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { user, logout, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the user dropdown on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/", { replace: true });
  };

  return (
    <header
      data-testid="app-header"
      className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link to="/" data-testid="brand-link" className="flex items-center gap-3 group">
          <div className="w-8 h-8 grid place-items-center bg-green-600 dark:bg-green-500 text-white dark:text-zinc-950 rounded-sm group-hover:bg-green-500 dark:group-hover:bg-green-400 transition-colors">
            <Terminal className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display font-black text-zinc-900 dark:text-zinc-50 text-base tracking-tight">TAKE MY INTERVIEW</span>
            <span className="font-mono-ui text-[10px] tracking-[0.25em] text-zinc-700 dark:text-zinc-200 uppercase">mock interview portal</span>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          <button
            data-testid="theme-toggle-btn"
            onClick={toggle}
            aria-label="Toggle theme"
            className="font-mono-ui text-xs uppercase tracking-[0.2em] text-zinc-800 dark:text-zinc-100 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 transition-colors flex items-center gap-2 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 rounded-sm"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="hidden sm:inline">{theme === "dark" ? "light" : "dark"}</span>
          </button>

          {!minimal && user && (
            <button
              data-testid="nav-history-btn"
              onClick={() => navigate("/history")}
              className="font-mono-ui text-xs uppercase tracking-[0.2em] text-zinc-800 dark:text-zinc-100 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 transition-colors flex items-center gap-2"
            >
              <HistoryIcon className="w-4 h-4" /> history
            </button>
          )}

          {!minimal && user && (
            <button
              data-testid="nav-start-btn"
              onClick={() => navigate("/setup")}
              className="font-mono-ui text-xs uppercase tracking-[0.2em] bg-green-600 dark:bg-green-500 text-white dark:text-zinc-950 hover:bg-green-500 dark:hover:bg-green-400 px-4 py-2 rounded-sm font-bold transition-colors"
            >
              start_interview
            </button>
          )}

          {/* Auth corner: show login/register when logged out, user menu when logged in. */}
          {!loading && !user && (
            <>
              <Link
                to="/login"
                data-testid="nav-login-btn"
                className="font-mono-ui text-xs uppercase tracking-[0.2em] text-zinc-800 dark:text-zinc-100 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 transition-colors flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">login</span>
              </Link>
              <Link
                to="/register"
                data-testid="nav-register-btn"
                className="font-mono-ui text-xs uppercase tracking-[0.2em] bg-green-600 dark:bg-green-500 text-white dark:text-zinc-950 hover:bg-green-500 dark:hover:bg-green-400 px-4 py-2 rounded-sm font-bold transition-colors flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">register</span>
              </Link>
            </>
          )}

          {!loading && user && (
            <div className="relative" ref={menuRef}>
              <button
                data-testid="nav-user-btn"
                onClick={() => setMenuOpen((v) => !v)}
                className="font-mono-ui text-xs uppercase tracking-[0.2em] text-zinc-800 dark:text-zinc-100 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 transition-colors flex items-center gap-2 border border-zinc-200 dark:border-zinc-800 hover:border-green-500 rounded-sm"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user.username}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>
              {menuOpen && (
                <div
                  data-testid="nav-user-menu"
                  className="absolute right-0 mt-2 w-56 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg"
                >
                  <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="font-mono-ui text-[10px] tracking-[0.25em] uppercase text-zinc-500">signed_in_as</div>
                    <div className="font-display font-bold text-zinc-900 dark:text-zinc-50 text-sm mt-1 truncate">
                      {user.full_name || user.username}
                    </div>
                    <div className="font-mono-ui text-[10px] text-zinc-500 truncate">{user.email}</div>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); navigate("/history"); }}
                    data-testid="nav-user-history"
                    className="w-full text-left px-4 py-3 font-mono-ui text-xs uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-green-600 dark:hover:text-green-400 transition-colors flex items-center gap-2"
                  >
                    <HistoryIcon className="w-3.5 h-3.5" /> history
                  </button>
                  <button
                    onClick={handleLogout}
                    data-testid="nav-user-logout"
                    className="w-full text-left px-4 py-3 font-mono-ui text-xs uppercase tracking-[0.2em] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <LogOut className="w-3.5 h-3.5" /> logout
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
