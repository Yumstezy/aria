import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import "@/styles/index.css";
import { connect } from "@/lib/aria";
import { Strip } from "./Strip";

connect();
createRoot(document.getElementById("root")!).render(<MotionConfig reducedMotion="user"><Strip /></MotionConfig>);
