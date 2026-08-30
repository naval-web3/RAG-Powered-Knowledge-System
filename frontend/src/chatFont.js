/**
 * Chat font — sets data-chat-font on <html>, persisted in localStorage.
 * Applies to the answer text and the user's bubbles, not to the interface,
 * which stays on Inter throughout.
 *
 * The serif is a system stack rather than a webfont: the project loads Inter
 * and JetBrains Mono and nothing else, and a reading serif is not worth a
 * third network request on a machine that already ships several good ones.
 */
const KEY = "retrieva-chat-font";

export const CHAT_FONTS = [
  { id: "sans", label: "Sans", sample: "Inter" },
  { id: "serif", label: "Serif", sample: "Iowan, Charter, Georgia" },
  { id: "mono", label: "Mono", sample: "JetBrains Mono" },
];

export function getChatFont() {
  const saved = localStorage.getItem(KEY);
  return CHAT_FONTS.some((f) => f.id === saved) ? saved : "sans";
}

export function applyChatFont(id = getChatFont()) {
  document.documentElement.setAttribute("data-chat-font", id);
}

export function setChatFont(id) {
  localStorage.setItem(KEY, id);
  applyChatFont(id);
}
