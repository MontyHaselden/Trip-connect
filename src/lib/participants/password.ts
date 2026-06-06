import bcrypt from "bcryptjs";

export async function hashParticipantPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyParticipantPassword(
  password: string,
  passwordHash: string | null | undefined,
) {
  if (!passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}
