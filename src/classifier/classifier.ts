import { adultPhrases, adultTerms } from "./lexicon";
import { compactText, normalizeText } from "./normalize";

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

const MAX_TEXT_LENGTH = 12000;

function countTerms(text: string): number {
  const words = text.split(" ");
  let count = 0;

  for (const word of words) {
    if (adultTerms.has(word)) count++;
  }

  return count;
}

function countPhrases(text: string): number {
  let count = 0;

  for (const phrase of adultPhrases) {
    if (text.includes(phrase)) count++;
  }

  return count;
}

function urlScore(url: string): number {
  let score = 0;

  for (const pattern of URL_PATTERNS) {
    if (pattern.test(url)) score += 20;
  }

  return score;
}

export function classify(input: {
  text?: string;
  url?: string;
  title?: string;
  alt?: string;
}): ClassificationResult {
  const raw = [input.text ?? "", input.title ?? "", input.alt ?? ""].join(" ");

  const text = normalizeText(raw).slice(0, MAX_TEXT_LENGTH);
  const compact = compactText(raw).slice(0, MAX_TEXT_LENGTH);

  let score = 0;
  const signals: string[] = [];

  const terms = countTerms(text);
  const phrases = countPhrases(text);
  const url = urlScore(input.url ?? "");

  if (terms > 0) {
    score += Math.min(terms * 14, 56);
    signals.push(`terms:${terms}`);
  }

  if (phrases > 0) {
    score += Math.min(phrases * 24, 72);
    signals.push(`phrases:${phrases}`);
  }

  if (url > 0) {
    score += Math.min(url, 60);
    signals.push("url");
  }

  if (adultTerms.has(compact)) {
    score += 35;
    signals.push("compact");
  }

  const explicitDensity =
    text.length > 0
      ? (terms + phrases * 2) / Math.max(text.split(" ").length, 1)
      : 0;

  if (explicitDensity > 0.04) {
    score += 25;
    signals.push("density");
  }

  score = Math.min(score, 100);

  return {
    score,
    blocked: score >= 70,
    signals,
  };
}
