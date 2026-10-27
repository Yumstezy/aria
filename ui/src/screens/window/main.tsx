import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import { connect } from "@/lib/aria";
import { AriaWindow } from "./Window";

const theme = new URLSearchParams(location.search).get("theme") === "sky" ? "sky" : "night";
document.documentElement.setAttribute("data-theme", theme);
connect();
createRoot(document.getElementById("root")!).render(<AriaWindow />);
