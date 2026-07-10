import axios from "axios";

// Resolved once at module load. Defaults to a same-origin `/api` path so the
// app works behind the nginx reverse-proxy without any `.env` file. Override by
// setting REACT_APP_BACKEND_URL in frontend/.env and restarting `npm start`.
const RAW_BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "")
  .replace(/^["']|["']$/g, "")  // strip accidental surrounding quotes
  .trim();
export const BACKEND_URL = (RAW_BACKEND_URL && RAW_BACKEND_URL.trim()) || "";
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

if (!RAW_BACKEND_URL) {
  // Loud warning so this never silently breaks again.
  // eslint-disable-next-line no-console
  console.warn(
    "[tmi] REACT_APP_BACKEND_URL is not set — defaulting to " + BACKEND_URL +
    ". To use a different backend, create frontend/.env with REACT_APP_BACKEND_URL=..."
  );
} else {
  // eslint-disable-next-line no-console
  console.info("[tmi] API base URL resolved to " + API);
}

export const api = axios.create({ baseURL: API });

// Attach the JWT (if any) to every outgoing request.
api.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("tmi_token") : null;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getTopics = () => api.get("/topics").then((r) => r.data.topics);
export const startInterview = (payload) => api.post("/interview/start", payload).then((r) => r.data);
export const submitAnswer = (session_id, answer) =>
  api.post("/interview/answer", { session_id, answer }).then((r) => r.data);
export const endInterview = (session_id) =>
  api.post(`/interview/end/${session_id}`).then((r) => r.data);
export const getInterview = (session_id) => api.get(`/interview/${session_id}`).then((r) => r.data);
export const listInterviews = (candidate_name) =>
  api
    .get("/interviews", { params: candidate_name ? { candidate_name } : {} })
    .then((r) => r.data.sessions);
export const transcribeAudio = (blob) => {
  const fd = new FormData();
  fd.append("file", blob, "recording.webm");
  return api.post("/voice/transcribe", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = ({ identifier, password }) =>
  api.post("/auth/login", { identifier, password }).then((r) => r.data);

export const register = (payload) =>
  api.post("/auth/register", payload).then((r) => r.data);

export const me = () => api.get("/auth/me").then((r) => r.data);
