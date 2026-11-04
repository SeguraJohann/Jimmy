/** Lowercase, no accents, collapsed spaces — for search and unique names. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesSearch(text: string, query: string): boolean {
  const q = normalize(query);
  return q === "" || normalize(text).includes(q);
}
