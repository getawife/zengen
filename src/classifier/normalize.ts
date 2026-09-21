const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const MARKS = /\p{M}/gu;
const SYMBOLS = /[^\p{L}\p{N}\s]/gu;
const SPACES = /\s+/g;
const LEET = /[013457]/g;

export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .normalize("NFD")
    .replace(MARKS, "")
    .toLowerCase()
    .replace(SYMBOLS, " ")
    .replace(SPACES, " ")
    .trim();
}

export function compactText(input: string): string {
  return normalizeText(input).replace(/\s/g, "");
}

export function normalizeObfuscatedText(input: string): string {
  return normalizeText(input)
    .replace(LEET, (character) => {
      const replacements: Record<string, string> = {
        "0": "o",
        "1": "i",
        "3": "e",
        "4": "a",
        "5": "s",
        "7": "t",
      };

      return replacements[character] ?? character;
    })
    .replace(/\s/g, "");
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);

  return normalized ? normalized.split(" ") : [];
}

export function getTokenWindow(
  tokens: string[],
  index: number,
  radius = 4,
): string[] {
  const start = Math.max(0, index - radius);
  const end = Math.min(tokens.length, index + radius + 1);

  return tokens.slice(start, end);
}

export function containsTokenSequence(
  tokens: string[],
  sequence: string[],
): boolean {
  if (sequence.length === 0 || sequence.length > tokens.length) {
    return false;
  }

  for (let index = 0; index <= tokens.length - sequence.length; index++) {
    let matches = true;

    for (let offset = 0; offset < sequence.length; offset++) {
      if (tokens[index + offset] !== sequence[offset]) {
        matches = false;
        break;
      }
    }

    if (matches) return true;
  }

  return false;
}

export function normalizeObfuscatedToken(input: string): string {
  return input
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .normalize("NFD")
    .replace(MARKS, "")
    .toLowerCase()
    .replace(SYMBOLS, "")
    .replace(LEET, (character) => {
      const replacements: Record<string, string> = {
        "0": "o",
        "1": "i",
        "3": "e",
        "4": "a",
        "5": "s",
        "7": "t",
      };

      return replacements[character] ?? character;
    });
}

export function normalizeObfuscatedSequence(input: string): string {
  return input
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .normalize("NFD")
    .replace(MARKS, "")
    .toLowerCase()
    .replace(SYMBOLS, "")
    .replace(LEET, (character) => {
      const replacements: Record<string, string> = {
        "0": "o",
        "1": "i",
        "3": "e",
        "4": "a",
        "5": "s",
        "7": "t",
      };

      return replacements[character] ?? character;
    });
}
