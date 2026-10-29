// If a screen throws while drawing, show a plain card instead of an empty page. The docked window is
// see-through, so an empty page looks like the window vanished (Oct 29: a clash had no size to label).
import { Component, type ReactNode } from "react";
import { send, showResult } from "@/lib/aria";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error) { send("ui_error", { message: String(error?.stack || error).slice(0, 600) }); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="m-3 rounded-2xl bg-card p-4 text-sm text-ink" style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.35)" }}>
        <b className="block">Aria couldn't show this result.</b>
        <p className="mt-1 text-ink-muted">Your mix is fine. This is a bug in Aria's screen.</p>
        <button className="cp-btn mt-3" onClick={() => { showResult(null); this.setState({ error: null }); }}>Clear it</button>
      </div>
    );
  }
}
