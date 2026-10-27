import { createRoot } from "react-dom/client";
import "@/styles/index.css";
import { connect } from "@/lib/aria";
import { AriaWindow } from "./Window";
import { ChatWindow } from "@/components/ask-muse";

connect();
// The same page also runs Ask Muse popped out into its own window (?view=chat)
const chat = new URLSearchParams(location.search).get("view") === "chat";
createRoot(document.getElementById("root")!).render(chat ? <ChatWindow /> : <AriaWindow />);
