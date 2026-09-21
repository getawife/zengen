import { adultPhrases, adultTerms } from "./lexicon.js";
import {
  compactText,
  containsTokenSequence,
  getTokenWindow,
  normalizeObfuscatedText,
  normalizeText,
  normalizeObfuscatedToken,
  normalizeObfuscatedSequence,
  tokenize,
} from "./normalize.js";

export interface ClassificationSignal {
  type:
    | "EXPLICIT_TERM"
    | "CONTEXTUAL_TERM"
    | "EXPLICIT_PHRASE"
    | "SAFE_CONTEXT"
    | "URL_MATCH"
    | "URL_OBFUSCATED_TERM"
    | "OBFUSCATED_TERM"
    | "HIGH_TERM_DENSITY"
    | "TITLE_CONTEXT";
  value?: string;
  source: "text" | "title" | "alt" | "url";
  weight: number;
}

export interface ClassificationResult {
  score: number;
  blocked: boolean;
  signals: ClassificationSignal[];
}

const MAX_TEXT_LENGTH = 16000;

const STRONG_TERMS = new Set([
  "porn",
  "porno",
  "pornography",
  "xxx",
  "sexcam",
  "sexvideo",
  "adultvideo",
  "adultcontent",
  "hentai",
  "rule34",
  "pornografia",
  "pornografie",
  "pornographie",
  "порно",
  "порнография",
  "色情",
  "情色",
  "포르노",
  "ポルノ",
  "إباحية",
  "پورن",
]);

const CONTEXTUAL_TERMS = new Set([
  "sex",
  "adult",
  "explicit",
  "nude",
  "nudity",
  "naked",
  "erotic",
  "sexo",
  "desnudo",
  "desnuda",
  "erotico",
  "erotica",
  "nackt",
  "nu",
  "nue",
  "裸体",
  "裸",
  "성인",
  "나체",
  "アダルト",
  "эротика",
  "обнаженный",
  "seks",
  "ciplak",
  "جنس",
  "عري",
  "سیکس",
  "برہنہ",
]);

const SAFE_CONTEXTS = [
  ["explicit", "formula"],
  ["explicit", "equation"],
  ["explicit", "function"],
  ["explicit", "solution"],
  ["explicit", "instructions"],
  ["explicit", "proof"],
  ["explicit", "expression"],
  ["adult", "education"],
  ["adult", "learning"],
  ["adult", "student"],
  ["adult", "students"],
  ["adult", "swimming"],
  ["adult", "responsibilities"],
  ["adult", "literacy"],
  ["adult", "training"],
  ["sex", "education"],
  ["sex", "education"],
  ["sex", "health"],
  ["sex", "healthcare"],
  ["sex", "biology"],
  ["sex", "chromosome"],
  ["sex", "chromosomes"],
  ["sex", "reproduction"],
  ["sex", "reproductive"],
  ["sex", "development"],
  ["sex", "differences"],
  ["sex", "determination"],
  ["naked", "eye"],
  ["naked", "eye"],
  ["nude", "color"],
  ["nude", "colour"],
  ["nude", "paint"],
  ["nude", "painting"],
  ["nude", "art"],
  ["nude", "photography"],
  ["nude", "figure"],
  ["nude", "figure"],
  ["nude", "model"],
];

const SAFE_PHRASES = [
  "sex education",
  "sexual health",
  "sexual education",
  "reproductive health",
  "adult education",
  "adult learning",
  "explicit formula",
  "explicit function",
  "explicit equation",
  "naked eye",
  "nude art",
  "nude photography",
  "figure drawing",
];

const URL_PATTERNS = [
  /porn/i,
  /nsfw/i,
  /adult[-_]?content/i,
  /sex[-_]?cam/i,
  /sex[-_]?video/i,
  /nude/i,
  /hentai/i,
  /rule34/i,
];

function countOccurrences(text: string, term: string): number {
  const tokens = tokenize(text);

  return tokens.filter((token) => token === term).length;
}

function containsSafeContext(tokens: string[], index: number): boolean {
  const window = getTokenWindow(tokens, index, 3);
  const context = new Set(window);

  return SAFE_CONTEXTS.some((phrase) =>
    phrase.every((term) => context.has(term)),
  );
}

function countStrongTerms(
  text: string,
  source: ClassificationSignal["source"],
): ClassificationSignal[] {
  const tokens = tokenize(text);
  const signals: ClassificationSignal[] = [];

  tokens.forEach((token, index) => {
    if (!STRONG_TERMS.has(token)) return;

    signals.push({
      type: "EXPLICIT_TERM",
      value: token,
      source,
      weight: 24,
    });
  });

  return signals;
}

function countContextualTerms(
  text: string,
  source: ClassificationSignal["source"],
): ClassificationSignal[] {
  const tokens = tokenize(text);
  const signals: ClassificationSignal[] = [];

  tokens.forEach((token, index) => {
    if (!CONTEXTUAL_TERMS.has(token)) return;

    if (containsSafeContext(tokens, index)) {
      signals.push({
        type: "SAFE_CONTEXT",
        value: token,
        source,
        weight: -14,
      });

      return;
    }

    signals.push({
      type: "CONTEXTUAL_TERM",
      value: token,
      source,
      weight: 3,
    });
  });

  return signals;
}

function countPhrases(
  text: string,
  source: ClassificationSignal["source"],
): ClassificationSignal[] {
  const tokens = tokenize(text);
  const signals: ClassificationSignal[] = [];

  for (const phrase of adultPhrases) {
    const normalizedPhrase = normalizeText(phrase);
    const phraseTokens = tokenize(normalizedPhrase);

    if (!containsTokenSequence(tokens, phraseTokens)) {
      continue;
    }

    if (SAFE_PHRASES.includes(normalizedPhrase)) {
      signals.push({
        type: "SAFE_CONTEXT",
        value: normalizedPhrase,
        source,
        weight: -18,
      });

      continue;
    }

    signals.push({
      type: "EXPLICIT_PHRASE",
      value: normalizedPhrase,
      source,
      weight: 30,
    });
  }

  return signals;
}

function matchingUrlSignals(url: string): ClassificationSignal[] {
  const signals: ClassificationSignal[] = [];
  const normalizedUrl = normalizeText(url);
  const compactUrl = compactText(url);
  const obfuscatedUrl = normalizeObfuscatedText(url);

  for (const pattern of URL_PATTERNS) {
    if (!pattern.test(url)) continue;

    signals.push({
      type: "URL_MATCH",
      source: "url",
      weight: 28,
    });
  }

  for (const term of STRONG_TERMS) {
    if (
      normalizedUrl.includes(term) ||
      compactUrl.includes(term) ||
      obfuscatedUrl.includes(term)
    ) {
      signals.push({
        type: "URL_OBFUSCATED_TERM",
        value: term,
        source: "url",
        weight: 60,
      });
    }
  }

  return signals;
}

function matchingObfuscatedTerms(
  text: string,
  source: ClassificationSignal["source"],
): ClassificationSignal[] {
  const tokens = tokenize(text);
  const normalizedTokens = tokens.map(normalizeObfuscatedToken);
  const normalizedSequence = normalizeObfuscatedSequence(tokens.join(""));

  const signals: ClassificationSignal[] = [];

  for (const term of STRONG_TERMS) {
    if (term.length < 5) {
      continue;
    }

    const exactMatch = tokens.includes(term);

    if (exactMatch) {
      continue;
    }

    const tokenMatch = normalizedTokens.includes(term);
    const sequenceMatch = normalizedSequence.includes(term);

    if (!tokenMatch && !sequenceMatch) {
      continue;
    }

    signals.push({
      type: "OBFUSCATED_TERM",
      value: term,
      source,
      weight: 40,
    });
  }

  return signals;
}

export function classify(input: {
  text?: string;
  url?: string;
  title?: string;
  alt?: string;
}): ClassificationResult {
  const rawText = input.text ?? "";
  const rawTitle = input.title ?? "";
  const rawAlt = input.alt ?? "";

  const text = normalizeText([rawText, rawTitle, rawAlt].join(" ")).slice(
    0,
    MAX_TEXT_LENGTH,
  );

  const title = normalizeText(rawTitle);
  const tokens = tokenize(text);

  const signals: ClassificationSignal[] = [];

  signals.push(
    ...countStrongTerms(rawText, "text"),
    ...countContextualTerms(rawText, "text"),
    ...countPhrases(rawText, "text"),
    ...countStrongTerms(rawTitle, "title"),
    ...countContextualTerms(rawTitle, "title"),
    ...countPhrases(rawTitle, "title"),
    ...countContextualTerms(rawAlt, "alt"),
    ...matchingUrlSignals(input.url ?? ""),
    ...matchingObfuscatedTerms(rawText, "text"),
  );

  const explicitTerms = signals.filter(
    (signal) => signal.type === "EXPLICIT_TERM",
  );

  const explicitPhrases = signals.filter(
    (signal) => signal.type === "EXPLICIT_PHRASE",
  );

  const safeContexts = signals.filter(
    (signal) => signal.type === "SAFE_CONTEXT",
  );

  const independentEvidence = new Set(
    signals
      .filter(
        (signal) =>
          signal.type === "EXPLICIT_TERM" ||
          signal.type === "EXPLICIT_PHRASE" ||
          signal.type === "URL_MATCH" ||
          signal.type === "URL_OBFUSCATED_TERM" ||
          signal.type === "OBFUSCATED_TERM",
      )
      .map((signal) => signal.type),
  );

  let score = signals.reduce((total, signal) => total + signal.weight, 0);

  if (explicitTerms.length > 0 && explicitPhrases.length > 0) {
    score += 15;

    signals.push({
      type: "TITLE_CONTEXT",
      source: title ? "title" : "text",
      weight: 15,
    });
  }

  const explicitCount = explicitTerms.length + explicitPhrases.length * 2;

  const density = tokens.length > 0 ? explicitCount / tokens.length : 0;

  if (density > 0.08 && explicitCount >= 2) {
    score += 20;

    signals.push({
      type: "HIGH_TERM_DENSITY",
      source: "text",
      weight: 20,
    });
  }

  if (independentEvidence.size >= 2) {
    score += 10;
  }

  if (safeContexts.length > 0 && explicitTerms.length === 0) {
    score = Math.min(score, 12);
  }

  score = Math.max(0, Math.min(score, 100));

  const hasStrongExplicitEvidence =
    explicitTerms.length >= 2 ||
    explicitPhrases.length >= 1 ||
    signals.some(
      (signal) =>
        signal.type === "URL_OBFUSCATED_TERM" ||
        signal.type === "OBFUSCATED_TERM",
    );

  const blocked =
    hasStrongExplicitEvidence && score >= 70 && independentEvidence.size >= 1;

  return {
    score,
    blocked,
    signals,
  };
}
