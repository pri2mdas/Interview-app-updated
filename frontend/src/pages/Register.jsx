import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Terminal, ArrowRight, UserPlus, Loader2, AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

function passwordChecks(pw) {
  return [
    { id: "len", label: "at least 6 characters", ok: pw.length >= 6 },
    { id: "alpha", label: "contains a letter", ok: /[A-Za-z]/.test(pw) },
    { id: "num", label: "contains a number", ok: /\d/.test(pw) },
  ];
}

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const checks = useMemo(() => passwordChecks(password), [password]);
  const allChecksPass = checks.every((c) => c.ok);
  const passwordsMatch = password === confirm && password.length > 0;

  const usernameOk = useMemo(
    () => username.length >= 3 && /^[A-Za-z0-9_.-]+$/.test(username),
    [username]
  );

  const canSubmit =
    fullName.trim().length > 0 &&
    usernameOk &&
    /\S+@\S+\.\S+/.test(email) &&
    allChecksPass &&
    passwordsMatch &&
    !submitting;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!canSubmit) {
      setError("Some fields are not valid. Check the requirements below.");
      return;
    }
    setSubmitting(true);
    try {
      await register({
        email: email.trim(),
        username: username.trim(),
        full_name: fullName.trim(),
        password,
      });
      toast.success("Account created. Welcome aboard.");
      navigate("/setup", { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Registration failed. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative z-10 bg-white dark:bg-zinc-950 flex flex-col">
      {/* Brand bar */}
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
            to="/login"
            data-testid="register-go-login"
            className="font-mono-ui text-xs uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 transition-colors"
          >
            have_account? <span className="text-green-600 dark:text-green-400">login</span>
          </Link>
        </div>
      </header>

      {/* Form area */}
      <main className="relative flex-1 grid lg:grid-cols-2">
        {/* Decorative left pane */}
        <section className="relative hidden lg:flex border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/40 overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-50" aria-hidden />
          <div className="relative m-auto w-full max-w-md p-10">
            <div className="font-mono-ui text-[11px] tracking-[0.3em] uppercase text-green-600 dark:text-green-400 mb-4">// session.init</div>
            <h2 className="font-display font-black text-zinc-900 dark:text-zinc-50 text-4xl tracking-tighter leading-[1.05]">
              Create your <span className="text-green-600 dark:text-green-400">candidate</span> handle.
            </h2>
            <p className="mt-5 font-mono-ui text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              One account keeps every interview, every report and every score card you generate — searchable,
              persistent, ready when you are.
            </p>

            <div className="mt-10 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
              <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-mono-ui text-[10px] tracking-[0.2em] uppercase text-zinc-500 ml-2">~/tmi/auth/register</span>
              </div>
              <pre className="font-mono-ui text-xs text-zinc-700 dark:text-zinc-300 p-4 leading-relaxed whitespace-pre-wrap">
{`$ ./tmi --register --user ${username || "<username>"}
> provisioning handle...
> hashing credentials (bcrypt)...
> ✓ stored locally in sqlite
> token issued. redirecting to /setup
`}
                <span className="cursor-blink" />
              </pre>
            </div>
          </div>
        </section>

        {/* Right pane — actual form */}
        <section className="flex items-center justify-center px-6 py-16 lg:py-12">
          <form onSubmit={submit} className="w-full max-w-md" data-testid="register-form">
            <div className="font-mono-ui text-[11px] tracking-[0.3em] uppercase text-green-600 dark:text-green-400 mb-3">// auth.register</div>
            <h1 className="font-display font-black text-zinc-900 dark:text-zinc-50 text-4xl sm:text-5xl tracking-tighter leading-[1]">
              Sign up.
            </h1>
            <p className="font-mono-ui text-sm text-zinc-500 dark:text-zinc-400 mt-3">
              No spam, no marketing emails. Just a key to your interview history.
            </p>

            {error && (
              <div
                data-testid="register-error"
                className="mt-6 border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 flex items-start gap-3"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <span className="font-mono-ui text-xs text-red-700 dark:text-red-300">{error}</span>
              </div>
            )}

            <div className="mt-8 space-y-5">
              <div>
                <label htmlFor="fullName" className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 dark:text-zinc-400 block mb-2">
                  full_name
                </label>
                <input
                  id="fullName"
                  data-testid="register-fullname"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Pritam Das"
                  className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-3 font-mono-ui text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="username" className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 dark:text-zinc-400 block mb-2">
                  username
                </label>
                <input
                  id="username"
                  data-testid="register-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="devops_candidate"
                  className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-3 font-mono-ui text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                />
                {username.length > 0 && !usernameOk && (
                  <p className="mt-2 font-mono-ui text-[10px] text-amber-600 dark:text-amber-400">
                    // 3+ chars · letters, numbers, _ . - only
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 dark:text-zinc-400 block mb-2">
                  email
                </label>
                <input
                  id="email"
                  data-testid="register-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-3 font-mono-ui text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="password" className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 dark:text-zinc-400 block mb-2">
                  password
                </label>
                <input
                  id="password"
                  data-testid="register-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-3 font-mono-ui text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                />
                {password.length > 0 && (
                  <ul className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1">
                    {checks.map((c) => (
                      <li
                        key={c.id}
                        className={`flex items-center gap-1 font-mono-ui text-[10px] ${
                          c.ok ? "text-green-600 dark:text-green-400" : "text-zinc-500 dark:text-zinc-500"
                        }`}
                      >
                        {c.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {c.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label htmlFor="confirm" className="font-mono-ui text-[10px] tracking-[0.3em] uppercase text-zinc-500 dark:text-zinc-400 block mb-2">
                  confirm_password
                </label>
                <input
                  id="confirm"
                  data-testid="register-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-3 font-mono-ui text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                />
                {confirm.length > 0 && !passwordsMatch && (
                  <p className="mt-2 font-mono-ui text-[10px] text-red-600 dark:text-red-400">
                    // passwords do not match
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              data-testid="register-submit"
              disabled={!canSubmit}
              className="mt-10 w-full font-mono-ui text-sm uppercase tracking-[0.2em] bg-green-600 dark:bg-green-500 text-white dark:text-zinc-950 hover:bg-green-500 dark:hover:bg-green-400 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500 disabled:cursor-not-allowed px-7 py-4 rounded-sm font-bold transition-colors inline-flex items-center justify-center gap-3"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {submitting ? "provisioning..." : "create_account()"}
            </button>

            <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between font-mono-ui text-xs text-zinc-500 dark:text-zinc-400">
              <span>// already registered?</span>
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline"
              >
                sign_in <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
