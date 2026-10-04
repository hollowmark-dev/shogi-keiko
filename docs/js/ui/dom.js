export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// スクリーンリーダー向けの読み上げ
export function announce(text) {
  const el = document.getElementById("sr-status");
  if (el) { el.textContent = ""; setTimeout(() => { el.textContent = text; }, 30); }
}
