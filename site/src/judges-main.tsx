import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import JudgesPage from "./JudgesPage";

createRoot(document.getElementById("root")!).render(<StrictMode><JudgesPage /></StrictMode>);
