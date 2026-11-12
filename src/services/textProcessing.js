export function stripVietnamese(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function normalizeText(text) {
  return stripVietnamese(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}&+\-/ ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitSemiColonText(text) {
  return String(text || "")
    .split(";")
    .map(value => value.trim())
    .filter(Boolean);
}

export function normalizedIncludes(text, keyword) {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword);
  return Boolean(normalizedKeyword) && normalizedText.includes(normalizedKeyword);
}
