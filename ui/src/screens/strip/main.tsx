import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import { connect } from "@/lib/aria";
import { Strip } from "./Strip";

connect();
createRoot(document.getElementById("root")!).render(<Strip />);
