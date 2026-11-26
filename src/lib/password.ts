import bcrypt from "bcryptjs";

/** bcrypt work factor. 12 ≈ 250 ms per hash: slow for attackers, fine for logins. */
const BCRYPT_ROUNDS = 12;

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(plain: string): Promise<string> {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    throw new RangeError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
