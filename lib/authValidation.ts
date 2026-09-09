const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

/** Password policy: min 8 chars, at least one letter and one digit. */
export function validatePasswordStrength(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Za-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  return true;
}
