import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import "@/styles/index.css";
import { connect } from "@/lib/aria";
import { installClipboard } from "@/lib/clipboard";
import { AriaWindow } from "./Window";
import { ChatWindow } from "@/components/ask-muse";
import { ErrorBoundary } from "@/components/error-boundary";

connect();
installClipboard();
// The same page also runs Ask Muse popped out into its own window (?view=chat)
const chat = new URLSearchParams(location.search).get("view") === "chat";
createRoot(document.getElementById("root")!).render(<MotionConfig reducedMotion="user"><ErrorBoundary>{chat ? <ChatWindow /> : <AriaWindow />}</ErrorBoundary></MotionConfig>);
