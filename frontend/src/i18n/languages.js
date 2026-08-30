/**
 * The languages the interface is offered in.
 *
 * Ordered to read across the picker's three columns, so the array order and
 * the grid the user sees are the same thing.
 *
 * `native` is what the language calls itself, `english` is the name a reader
 * who does not know that script can still recognise. Both are shown, because a
 * picker written only in scripts you cannot read is no help getting back out.
 */
export const LANGUAGES = [
  { id: "en-US", native: "English (United States)", english: "English (United States)", dir: "ltr" },
  { id: "fr-FR", native: "Français (France)", english: "French (France)", dir: "ltr" },
  { id: "de-DE", native: "Deutsch (Deutschland)", english: "German (Germany)", dir: "ltr" },
  { id: "hi-IN", native: "हिन्दी (भारत)", english: "Hindi (India)", dir: "ltr" },
  { id: "id-ID", native: "Indonesia (Indonesia)", english: "Indonesian (Indonesia)", dir: "ltr" },
  { id: "it-IT", native: "Italiano (Italia)", english: "Italian (Italy)", dir: "ltr" },
  { id: "ja-JP", native: "日本語 (日本)", english: "Japanese (Japan)", dir: "ltr" },
  { id: "ko-KR", native: "한국어 (대한민국)", english: "Korean (South Korea)", dir: "ltr" },
  { id: "pt-BR", native: "Português (Brasil)", english: "Portuguese (Brazil)", dir: "ltr" },
  { id: "es-419", native: "Español (Latinoamérica)", english: "Spanish (Latin America)", dir: "ltr" },
  { id: "es-ES", native: "Español (España)", english: "Spanish (Spain)", dir: "ltr" },
];

export const DEFAULT_LOCALE = "en-US";

export function isLocale(id) {
  return LANGUAGES.some((l) => l.id === id);
}

export function languageOf(id) {
  return LANGUAGES.find((l) => l.id === id) || LANGUAGES[0];
}
