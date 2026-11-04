const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Short random id for embedded rows (blocks, days, session rows). */
export function shortId(): string {
  let out = "";
  for (let i = 0; i < 10; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}
