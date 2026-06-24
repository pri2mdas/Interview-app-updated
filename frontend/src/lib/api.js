import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

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
