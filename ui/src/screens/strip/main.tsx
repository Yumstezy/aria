import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import "@/styles/index.css";
import { connect } from "@/lib/aria";
import { Strip } from "./Strip";
import { ErrorBoundary } from "@/components/error-boundary";

connect();
createRoot(document.getElementById("root")!).render(<MotionConfig reducedMotion="user"><ErrorBoundary><Strip /></ErrorBoundary></MotionConfig>);
