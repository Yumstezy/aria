import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import { connect } from "@/lib/aria";
import { Strip } from "./Strip";

const theme = new URLSearchParams(location.search).get("theme") === "sky" ? "sky" : "night";
document.documentElement.setAttribute("data-theme", theme);
connect();
createRoot(document.getElementById("root")!).render(<Strip />);
