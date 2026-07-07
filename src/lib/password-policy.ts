/**
 * Password policy & HIBP check (Audit Fix #12 / P3).
 *
 * Strengthens password security beyond the basic length/complexity check:
 *   1. Checks the password against the Have I Been Pwned (HIBP) database
 *      using the k-anonymity API (only sends first 5 chars of SHA-1 hash).
 *   2. Enforces a strong policy: min 10 chars, upper+lower+digits+symbols.
 *   3. Password history (checked against last 5 passwords stored hashed).
 *
 * Usage:
 *   const result = await validatePasswordStrength(password, userEmail);
 *   if (!result.valid) { showError(result.errors); }
 */

const HIBP_API = 'https://api.pwnedpasswords.com/range';

export interface PasswordValidationResult {
  valid: boolean;
  score: 0 | 1 | 2 | 3 | 4; // 0 = very weak, 4 = strong
  errors: string[];
  warnings: string[];
  breached?: boolean;
  breachCount?: number;
}

const STRONG_POLICY = {
  minLength: 10,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSymbol: true,
};

/**
 * Compute SHA-1 hash of a string (used for HIBP k-anonymity lookup).
 */
async function sha1Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Check if a password has been leaked in known data breaches.
 * Uses HIBP k-anonymity API: only sends first 5 chars of SHA-1 hash.
 * @returns number of times the password appeared in breaches (0 = safe)
 */
export async function checkPasswordBreach(password: string): Promise<number> {
  try {
    const hash = await sha1Hash(password);
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    const response = await fetch(`${HIBP_API}/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });

    if (!response.ok) {
      // HIBP unavailable — fail open (don't block signup)
      console.warn('[HIBP] API unavailable, skipping breach check');
      return 0;
    }

    const text = await response.text();
    const lines = text.split('\n');
    for (const line of lines) {
      const [hashSuffix, count] = line.trim().split(':');
      if (hashSuffix === suffix) {
        return parseInt(count, 10) || 0;
      }
    }
    return 0;
  } catch (e) {
    console.warn('[HIBP] Check failed:', e);
    return 0; // fail open
  }
}

/**
 * Evaluate password strength locally (no network call).
 */
export function evaluatePasswordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < STRONG_POLICY.minLength) {
    errors.push(`Le mot de passe doit contenir au moins ${STRONG_POLICY.minLength} caractères`);
  }
  if (STRONG_POLICY.requireUpper && !/[A-Z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une majuscule');
  }
  if (STRONG_POLICY.requireLower && !/[a-z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une minuscule');
  }
  if (STRONG_POLICY.requireDigit && !/[0-9]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre');
  }
  if (STRONG_POLICY.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un caractère spécial');
  }

  // Calculate score
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (password.length >= 8) score = 1;
  if (password.length >= 10 && /[A-Z]/.test(password) && /[a-z]/.test(password)) score = 2;
  if (score >= 2 && /[0-9]/.test(password)) score = 3;
  if (score >= 3 && /[^A-Za-z0-9]/.test(password) && password.length >= 12) score = 4;

  if (errors.length > 0) score = 0;

  return { score, errors };
}

/**
 * Full password validation: policy + HIBP breach check.
 */
export async function validatePasswordStrength(
  password: string,
  userEmail?: string
): Promise<PasswordValidationResult> {
  const { score, errors } = evaluatePasswordStrength(password);
  const warnings: string[] = [];

  // Check against email (common mistake)
  if (userEmail && password.toLowerCase().includes(userEmail.toLowerCase().split('@')[0])) {
    errors.push('Le mot de passe ne doit pas contenir votre email');
  }

  // Check common passwords
  const common = ['password', 'motdepasse', '12345678', 'azertyuiop', 'qwerty'];
  if (common.some((p) => password.toLowerCase().includes(p))) {
    errors.push('Le mot de passe est trop commun');
  }

  // HIBP breach check
  const breachCount = await checkPasswordBreach(password);
  const breached = breachCount > 0;

  if (breached) {
    errors.push(
      `Ce mot de passe a été vu ${breachCount} fois dans des fuites de données. Veuillez en choisir un autre.`
    );
  }

  return {
    valid: errors.length === 0,
    score: breached ? 0 : score,
    errors,
    warnings,
    breached,
    breachCount,
  };
}

/**
 * Check password against history (last 5 passwords).
 * The history should be stored as an array of SHA-256 hashes.
 */
export async function checkPasswordHistory(
  password: string,
  history: string[]
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return history.includes(hash);
}

/**
 * Hash a password for history storage (SHA-256).
 */
export async function hashForHistory(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a strong random password suggestion.
 */
export function generateStrongPassword(length: number = 16): string {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = lower + upper + digits + symbols;

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  const chars = [
    lower[array[0] % lower.length],
    upper[array[1] % upper.length],
    digits[array[2] % digits.length],
    symbols[array[3] % symbols.length],
  ];

  for (let i = 4; i < length; i++) {
    chars.push(all[array[i] % all.length]);
  }

  // Shuffle (Fisher-Yates)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = array[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
