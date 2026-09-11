import { adultPhrases, adultTerms } from "./lexicon.js";
import {
  compactText,
  normalizeObfuscatedText,
  normalizeText,
} from "./normalize.js";

export interface ClassificationResult {
  score: number;
  blocked: boolean;
  signals: string[];
}

const URL_PATTERNS = [
  /porn/i,
  /xxx/i,
  /nsfw/i,
  /adult[-_]?content/i,
  /sex[-_]?cam/i,
  /sex[-_]?video/i,
  /nude/i,
  /hentai/i,
  /rule34/i,
];

const MAX_TEXT_LENGTH = 16000;
const WEAK_TERMS = new Set(["sex", "adult", "explicit"]);

function countTerms(text: string): number {
  const words = text.split(" ");
  let count = 0;

  for (const word of words) {
    if (adultTerms.has(word)) count++;
  }

  return count;
}

function countStrongTerms(text: string): number {
  return text
    .split(" ")
    .filter((word) => adultTerms.has(word) && !WEAK_TERMS.has(word)).length;
}

function countPhrases(text: string): number {
  let count = 0;

  for (const phrase of adultPhrases) {
    if (text.includes(phrase)) count++;
  }

  return count;
}

function matchingUrlSignals(url: string): string[] {
  const signals: string[] = [];

  for (const pattern of URL_PATTERNS) {
    if (pattern.test(url)) signals.push("URL_MATCH");
  }

  return [...new Set(signals)];
}

function hasObfuscatedTerm(compact: string, obfuscated: string): boolean {
  for (const term of adultTerms) {
    if (WEAK_TERMS.has(term) || term.length < 4) continue;
    if (compact.includes(term) || obfuscated.includes(term)) return true;
  }

  return false;
}

export function classify(input: {
  text?: string;
  url?: string;
  title?: string;
  alt?: string;
}): ClassificationResult {
  const title = normalizeText(input.title ?? "");
  const raw = [input.text ?? "", input.title ?? "", input.alt ?? ""].join(" ");

  const text = normalizeText(raw).slice(0, MAX_TEXT_LENGTH);
  const compact = compactText(raw).slice(0, MAX_TEXT_LENGTH);
  const obfuscated = normalizeObfuscatedText(raw).slice(0, MAX_TEXT_LENGTH);

  let score = 0;
  const signals: string[] = [];

  const terms = countTerms(text);
  const strongTerms = countStrongTerms(text);
  const phrases = countPhrases(text);
  const urlSignals = matchingUrlSignals(input.url ?? "");

  if (strongTerms > 0) {
    score += Math.min(strongTerms * 18, 54);
    signals.push("EXPLICIT_TERM_CLUSTER");
  } else if (terms > 0) {
    score += 8;
    signals.push("WEAK_TERM");
  }

  if (phrases > 0) {
    score += Math.min(phrases * 28, 56);
    signals.push("EXPLICIT_PHRASE");
  }

  if (urlSignals.length > 0) {
    score += 30;
    signals.push(...urlSignals);
  }

  if (hasObfuscatedTerm(compact, obfuscated)) {
    score += 50;
    signals.push("OBFUSCATED_TERM");
  }

  const explicitDensity =
    text.length > 0
      ? (terms + phrases * 2) / Math.max(text.split(" ").length, 1)
      : 0;

  if (explicitDensity > 0.04) {
    score += 20;
    signals.push("HIGH_TERM_DENSITY");
  }

  if (title && (phrases > 0 || strongTerms > 0)) {
    score += 12;
    signals.push("TITLE_CONTEXT");
  }

  score = Math.min(score, 100);

  const independentSignals = new Set(
    signals.filter((signal) => signal !== "WEAK_TERM" && signal !== "TITLE_CONTEXT"),
  );

  if (independentSignals.size >= 2) {
    score = Math.min(score + 10, 100);
    signals.push("MULTIPLE_SIGNALS");
  }

  return {
    score,
    blocked: score >= 80 && independentSignals.size >= 2,
    signals: [...new Set(signals)],
  };
}
