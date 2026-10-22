/** Client-side password rules. Server/auth should enforce the same minimum. */

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordCheck = {
  ok: boolean;
  errors: string[];
  score: 0 | 1 | 2 | 3 | 4;
};

export function checkPassword(password: string): PasswordCheck {
  const errors: string[] = [];
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Τουλάχιστον ${MIN_PASSWORD_LENGTH} χαρακτήρες`);
  }
  if (!/[a-zA-Z]/.test(password)) {
    errors.push('Τουλάχιστον ένα γράμμα');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Τουλάχιστον έναν αριθμό');
  }
  // Common weak passwords
  const weak = ['password', '12345678', 'qwerty123', 'fresh2go', 'admin123'];
  if (weak.some((w) => password.toLowerCase().includes(w))) {
    errors.push('Πολύ κοινός κωδικός — διάλεξε κάτι πιο δυνατό');
  }

  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (password.length >= 8) score = 1;
  if (password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password)) score = 2;
  if (score >= 2 && /[0-9]/.test(password)) score = 3;
  if (score >= 3 && /[^a-zA-Z0-9]/.test(password) && password.length >= 12) score = 4;
  if (errors.length) score = Math.min(score, 1) as 0 | 1;

  return { ok: errors.length === 0, errors, score };
}

export function passwordErrorMessage(password: string): string | null {
  const r = checkPassword(password);
  return r.ok ? null : r.errors[0] ?? 'Μη έγκυρος κωδικός';
}
