// Copy and paste inside Live (Ian, Oct 30: "you can't copy and paste"). Live's web view doesn't run the page's own
// Cmd+C / Cmd+V / Cmd+X / Cmd+A, so the page does them itself: through the clipboard API when the view allows it,
// else the browser's copy and paste commands.
function selectedText(el: Element | null) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0);
  return document.getSelection()?.toString() ?? "";
}

function insert(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? el.value.length;
  // setRangeText then an input event, so React's onChange sees the new value
  el.setRangeText(text, a, b, "end");
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

async function copy(text: string) {
  if (!text) return;
  try { await navigator.clipboard.writeText(text); } catch { document.execCommand("copy"); }
}

export function installClipboard() {
  document.addEventListener("keydown", async (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const el = document.activeElement;
    const field = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
    const key = e.key.toLowerCase();
    if (key === "c") { e.preventDefault(); await copy(selectedText(el)); }
    else if (key === "x" && field) { e.preventDefault(); await copy(selectedText(field)); insert(field, ""); }
    else if (key === "a" && field) { e.preventDefault(); field.select(); }
    else if (key === "v" && field) {
      e.preventDefault();
      try { insert(field, await navigator.clipboard.readText()); } catch { document.execCommand("paste"); }
    }
  });
}
