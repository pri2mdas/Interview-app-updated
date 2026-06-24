import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "@/pages/Landing";
import Setup from "@/pages/Setup";
import Interview from "@/pages/Interview";
import Report from "@/pages/Report";
import History from "@/pages/History";
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

function App() {
  return (
    <ThemeProvider>
      <div className="App grain">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/interview/:sessionId" element={<Interview />} />
            <Route path="/report/:sessionId" element={<Report />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </BrowserRouter>
        <ThemedToaster />
      </div>
    </ThemeProvider>
  );
}

export default App;
