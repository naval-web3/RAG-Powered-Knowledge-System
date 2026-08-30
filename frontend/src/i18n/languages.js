/**
 * The languages the interface is offered in.
 *
 * Ordered to read across the picker's columns, so the array order and the grid
 * the user sees are the same thing.
 *
 * `native` is what the language calls itself, `english` is the name a reader
 * who does not know that script can still recognise. Both are shown, because a
 * picker written only in scripts you cannot read is no help getting back out.
 *
 * `short` is for anywhere the full name does not fit -- the user menu's row,
 * where "English (United States)" was being cut to "English (Unit…". It is the
 * language's own name and nothing else, except for the two Spanish entries,
 * which would otherwise read identically and so keep an abbreviated region.
 * The country belongs in the picker, where there is room to spell it out.
 */
export const LANGUAGES = [
  { id: "en-US", native: "English (United States)", short: "English", english: "English (United States)", dir: "ltr" },
  { id: "fr-FR", native: "Français (France)", short: "Français", english: "French (France)", dir: "ltr" },
  { id: "de-DE", native: "Deutsch (Deutschland)", short: "Deutsch", english: "German (Germany)", dir: "ltr" },
  { id: "hi-IN", native: "हिन्दी (भारत)", short: "हिन्दी", english: "Hindi (India)", dir: "ltr" },
  { id: "id-ID", native: "Indonesia (Indonesia)", short: "Indonesia", english: "Indonesian (Indonesia)", dir: "ltr" },
  { id: "it-IT", native: "Italiano (Italia)", short: "Italiano", english: "Italian (Italy)", dir: "ltr" },
  { id: "ja-JP", native: "日本語 (日本)", short: "日本語", english: "Japanese (Japan)", dir: "ltr" },
  { id: "ko-KR", native: "한국어 (대한민국)", short: "한국어", english: "Korean (South Korea)", dir: "ltr" },
  { id: "pt-BR", native: "Português (Brasil)", short: "Português", english: "Portuguese (Brazil)", dir: "ltr" },
  // The only two that would read identically without a region.
  { id: "es-419", native: "Español (Latinoamérica)", short: "Español (LA)", english: "Spanish (Latin America)", dir: "ltr" },
  { id: "es-ES", native: "Español (España)", short: "Español (ES)", english: "Spanish (Spain)", dir: "ltr" },
];

export const DEFAULT_LOCALE = "en-US";

export function isLocale(id) {
  return LANGUAGES.some((l) => l.id === id);
}

export function languageOf(id) {
  return LANGUAGES.find((l) => l.id === id) || LANGUAGES[0];
}
