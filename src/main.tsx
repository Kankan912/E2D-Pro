import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "@/lib/sentry";

// Initialize Sentry BEFORE React renders so we capture early errors.
// No-op if VITE_SENTRY_DSN is not set (safe for dev/preview).
initSentry();

createRoot(document.getElementById("root")!).render(<App />);
