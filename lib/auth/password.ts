import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
const SALT_BYTES = 16;
const HASH_BYTES = 64;
export const hashPassword = (password: string): string => {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derived = scryptSync(password, salt, HASH_BYTES);

  return `${salt}:${derived.toString("hex")}`;
};
export const verifyPassword = (
  password: string,
  hashedPassword: string,
): boolean => {
  const [rawSalt, storedHash] = hashedPassword.split(":");
  if (!rawSalt || !storedHash) {
    return false;
  }
  const candidate = scryptSync(password, rawSalt, HASH_BYTES);
  const current = Buffer.from(storedHash, "hex");
  if (candidate.length !== current.length) {
    return false;
  }
  return timingSafeEqual(candidate, current);
};
