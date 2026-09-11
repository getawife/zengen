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
    .toLocaleLowerCase()
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
