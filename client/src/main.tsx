import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/registerServiceWorker";
import { applyTheme, getStoredTheme } from "./lib/theme";

// Apply theme before paint so iOS status bar / overscroll match dark mode
applyTheme(getStoredTheme());

registerServiceWorker();
createRoot(document.getElementById("root")!).render(<App />);
