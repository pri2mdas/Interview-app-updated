import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import Landing from "@/pages/Landing";
import Setup from "@/pages/Setup";
import Interview from "@/pages/Interview";
import Report from "@/pages/Report";
import History from "@/pages/History";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "@/lib/theme";

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="top-right"
      toastOptions={{
        style: theme === "dark"
          ? { background: "#18181b", border: "1px solid #27272a", color: "#fafafa" }
          : { background: "#ffffff", border: "1px solid #e4e4e7", color: "#18181b" },
      }}
    />
  );
}

/**
 * Wrap any route that requires authentication. While the AuthContext is still
 * resolving the persisted token, shows a tiny spinner so we don't bounce the
 * user to /login on a page reload.
 */
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-white dark:bg-zinc-950">
        <div className="font-mono-ui text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
          <span className="text-green-600 dark:text-green-400">$</span> checking_session
          <span className="cursor-blink ml-1" />
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

/** Already-authenticated users shouldn't see /login or /register again. */
function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/setup" replace />;
  return children;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="App grain">
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
              <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />
              <Route path="/setup" element={<RequireAuth><Setup /></RequireAuth>} />
              <Route path="/interview/:sessionId" element={<RequireAuth><Interview /></RequireAuth>} />
              <Route path="/report/:sessionId" element={<RequireAuth><Report /></RequireAuth>} />
              <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <ThemedToaster />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
