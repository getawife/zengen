const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const MARKS = /\p{M}/gu;
const SYMBOLS = /[^\p{L}\p{N}\s]/gu;
const SPACES = /\s+/g;

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
