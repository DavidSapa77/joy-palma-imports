import "server-only";

import { randomInt } from "node:crypto";

/**
 * Temporary passwords for new users and password resets (UI spec §4.14).
 * Shown once to the Owner, who passes it on; the user must replace it at
 * first sign-in (mustChangePassword).
 *
 * Format: three groups of four, e.g. "Hq7m-Xc4T-p9Rw" — 12 random characters
 * from a 57-symbol alphabet without look-alikes (0/O, 1/l/I), ≈ 70 bits of
 * entropy, cryptographically random, with at least one upper-case letter,
 * lower-case letter and digit.
 */
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const ALPHABET = UPPER + LOWER + DIGITS;

export const TEMPORARY_PASSWORD_PATTERN = /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/;

export function generateTemporaryPassword(): string {
  for (;;) {
    const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]!);
    const s = chars.join("");
    if (/[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)) {
      return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
    }
  }
}
