import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Terminal, ArrowRight, LogIn, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Where to send the user after a successful login (defaults to /setup so they can start).
  const next = location.state?.from || "/setup";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!identifier.trim() || !password) {
      setError("Both fields are required.");
      return;
    }
    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
      toast.success("Authenticated. Welcome back.");
      navigate(next, { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Login failed. Check your credentials.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative z-10 bg-white dark:bg-zinc-950 flex flex-col">
      {/* Brand bar (matches Nav styling but minimal — no need for full nav on auth screens) */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 grid place-items-center bg-green-600 dark:bg-green-500 text-white dark:text-zinc-950 rounded-sm group-hover:bg-green-500 dark:group-hover:bg-green-400 transition-colors">
              <Terminal className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-display font-black text-zinc-900 dark:text-zinc-50 text-base tracking-tight">TAKE MY INTERVIEW</span>
              <span className="font-mono-ui text-[10px] tracking-[0.25em] text-zinc-500 dark:text-zinc-400 uppercase">mock interview portal</span>
            </div>
          </Link>
          <Link
            to="/register"
            data-testid="login-go-register"
            className="font-mono-ui text-xs uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 transition-colors"
          >
            need_account? <span className="text-green-600 dark:text-green-400">register</span>
          </Link>
        </div>
      </header>

      {/* Form area */}
      <main className="relative flex-1 grid lg:grid-cols-2">
        {/* Decorative left pane — terminal session */}
        <section className="relative hidden lg:flex border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/40 overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />
          <div className="relative m-auto w-full max-w-md p-10">
            <div className="font-mono-ui text-[11px] tracking-[0.3em] uppercase text-green-600 dark:text-green-400 mb-4">// session.resume</div>
            <h2 className="font-display font-black text-zinc-900 dark:text-zinc-50 text-4xl tracking-tighter leading-[1.05]">
              Pick up <span className="text-green-600 dark:text-green-400">where you left off.</span>
            </h2>
            <p className="mt-5 font-mono-ui text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Your interview history, mastery scores and per-topic notes are all tied to your account.
              Sign in to keep your prep loop running.
            </p>

            <div className="mt-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
              <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-mono-ui text-[10px] tracking-[0.2em] uppercase text-zinc-500 ml-2">~/tmi/auth</span>
              </div>
              <pre className="font-mono-ui text-xs text-zinc-700 dark:text-zinc-300 p-4 leading-relaxed whitespace-pre-wrap">
{`$ ./tmi --login
> authenticating...
> ✓ credentials accepted
> loading profile: ${identifier || "your_handle"}
> ready.
`}
                <span className="cursor-blink" />
              </pre>
            </div>
          </div>
        </section>

        {/* Right pane — actual form */}
        <section className="flex items-center justify-center px-6 py-16 lg:py-24">
          <form
            onSubmit={submit}
            className="w-full max-w-md"
            data-testid="login-form"
          >
            <div className="font-mono-ui text-[11px] tracking-[0.3em] uppercase text-green-600 dark:text-green-400 mb-3">// auth.login</div>
            <h1 className="font-display font-black text-zinc-900 dark:text-zinc-50 text-4xl sm:text-5xl tracking-tighter leading-[1]">
              Sign in.
            </h1>
            <p className="font-mono-ui text-sm text-zinc-500 dark:text-zinc-400 mt-3">
              Enter the credentials you used at registration.
            </p>

            {error && (
              <div
                data-testid="login-error"
                className="mt-6 border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 flex items-start gap-3"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <span className="font-mono-ui text-xs text-red-700 dark:text-red-300">{error}</span>
              </div>
            )}

            <div className="mt-8 space-y-6">
              <div>
                <label
                  htmlFor="identifier"
                  className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 dark:text-zinc-400 block mb-2"
                >
                  username_or_email
                </label>
                <input
                  id="identifier"
                  data-testid="login-identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="root@candidate"
                  className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-3 font-mono-ui text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 dark:text-zinc-400 block mb-2"
                >
                  password
                </label>
                <input
                  id="password"
                  data-testid="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-3 font-mono-ui text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              data-testid="login-submit"
              disabled={submitting}
              className="mt-10 w-full font-mono-ui text-sm uppercase tracking-[0.2em] bg-green-600 dark:bg-green-500 text-white dark:text-zinc-950 hover:bg-green-500 dark:hover:bg-green-400 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500 disabled:cursor-not-allowed px-7 py-4 rounded-sm font-bold transition-colors inline-flex items-center justify-center gap-3"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {submitting ? "authenticating..." : "authenticate()"}
            </button>

            <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between font-mono-ui text-xs text-zinc-500 dark:text-zinc-400">
              <span>// no account yet?</span>
              <Link
                to="/register"
                className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline"
              >
                register <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
