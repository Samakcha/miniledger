import crypto from 'crypto';

/**
 * ARCHITECTURAL NOTE: In-Memory OTP Store
 * 
 * This in-memory implementation stores OTPs and rate-limit counters in Node.js process memory.
 * - Caveat 1: Pending OTPs and rate-limit states are lost if the server process restarts.
 * - Caveat 2: This is NOT suitable for multi-instance or clustered production deployments,
 *   as requests from the same user across different instances will hit different in-memory stores.
 * - For a production deployment, replace this store with an external distributed cache
 *   such as Redis or Memcached with native key TTLs.
 */

export interface OtpRecord {
  otp: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

export interface RateLimitRecord {
  requestTimestamps: number[];
}

export const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_VERIFY_ATTEMPTS = 5;
export const MAX_REQUESTS_PER_WINDOW = 3;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Normalizes phone numbers consistently.
 * Strips whitespace, hyphens, periods, and parentheses.
 * Ensures the result has 7 to 15 digits and starts with a leading '+'.
 */
export function normalizePhoneNumber(phone: string): string {
  if (typeof phone !== 'string') {
    throw new Error('Phone number must be a string');
  }

  const trimmed = phone.trim();
  if (!trimmed) {
    throw new Error('Phone number is required');
  }

  const cleaned = trimmed.replace(/[\s\-\(\)\.]/g, '');
  const digitsOnly = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;

  if (!/^\d{7,15}$/.test(digitsOnly)) {
    throw new Error('Invalid phone number format. Must contain 7 to 15 digits.');
  }

  return `+${digitsOnly}`;
}

export class OtpService {
  private otpStore = new Map<string, OtpRecord>();
  private rateLimitStore = new Map<string, RateLimitRecord>();

  /**
   * Generates a cryptographically secure 6-digit OTP and stores it.
   */
  public requestOtp(
    normalizedPhone: string,
    options?: { customTtlMs?: number }
  ): { success: boolean; error?: string; status?: number } {
    const now = Date.now();

    // 1. Check rate limit
    const rateLimit = this.rateLimitStore.get(normalizedPhone) || { requestTimestamps: [] };
    // Filter timestamps within the sliding window
    rateLimit.requestTimestamps = rateLimit.requestTimestamps.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );

    if (rateLimit.requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      return {
        success: false,
        status: 429,
        error: 'Too many OTP requests for this phone number. Please wait before trying again.',
      };
    }

    // Record this request timestamp
    rateLimit.requestTimestamps.push(now);
    this.rateLimitStore.set(normalizedPhone, rateLimit);

    // 2. Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const ttl = options?.customTtlMs !== undefined ? options.customTtlMs : OTP_EXPIRY_MS;
    const expiresAt = now + ttl;

    // 3. Store OTP record (overwriting any previous active OTP for this phone)
    this.otpStore.set(normalizedPhone, {
      otp,
      expiresAt,
      attempts: 0,
      createdAt: now,
    });

    // 4. Print OTP to console for development / demo purposes
    console.log(`[AUTH] Generated OTP for ${normalizedPhone}: ${otp}`);

    return { success: true };
  }

  /**
   * Verifies an OTP using constant-time comparison.
   * Consumes the OTP on success.
   * Tracks and exhausts attempts on failure.
   */
  public verifyOtp(
    normalizedPhone: string,
    inputOtp: string
  ): { valid: boolean; error?: string; status?: number } {
    if (!inputOtp || typeof inputOtp !== 'string') {
      return { valid: false, status: 400, error: 'OTP is required' };
    }

    const trimmedOtp = inputOtp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      return { valid: false, status: 400, error: 'OTP must be a 6-digit number' };
    }

    const record = this.otpStore.get(normalizedPhone);
    const now = Date.now();

    // 1. Check if OTP exists
    if (!record) {
      return {
        valid: false,
        status: 400,
        error: 'Invalid or expired OTP. Please request a new code.',
      };
    }

    // 2. Check if expired
    if (now > record.expiresAt) {
      this.otpStore.delete(normalizedPhone);
      return {
        valid: false,
        status: 400,
        error: 'OTP has expired. Please request a new code.',
      };
    }

    // 3. Check if attempts already exceeded
    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      this.otpStore.delete(normalizedPhone);
      return {
        valid: false,
        status: 429,
        error: 'Maximum verification attempts exceeded. Please request a new OTP.',
      };
    }

    // 4. Increment attempt counter
    record.attempts += 1;

    // 5. Constant-time comparison
    const isMatch = this.timingSafeEqual(record.otp, trimmedOtp);

    if (!isMatch) {
      // If reached max attempts on this try, exhaust and delete OTP
      if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
        this.otpStore.delete(normalizedPhone);
        return {
          valid: false,
          status: 429,
          error: 'Maximum verification attempts exceeded. Please request a new OTP.',
        };
      }

      const remainingAttempts = MAX_VERIFY_ATTEMPTS - record.attempts;
      return {
        valid: false,
        status: 400,
        error: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
      };
    }

    // 6. Success: consume OTP immediately so it cannot be reused
    this.otpStore.delete(normalizedPhone);
    return { valid: true };
  }

  /**
   * Helper for constant-time string comparison to mitigate timing attacks.
   */
  private timingSafeEqual(stored: string, input: string): boolean {
    if (stored.length !== input.length) {
      return false;
    }
    const storedBuf = Buffer.from(stored, 'utf8');
    const inputBuf = Buffer.from(input, 'utf8');
    return crypto.timingSafeEqual(storedBuf, inputBuf);
  }

  /**
   * Test inspection helper (only used in isolated test runners).
   */
  public getStoredOtpForTesting(normalizedPhone: string): string | undefined {
    return this.otpStore.get(normalizedPhone)?.otp;
  }

  /**
   * Resets in-memory state (used for testing isolation).
   */
  public resetStore(): void {
    this.otpStore.clear();
    this.rateLimitStore.clear();
  }
}

export const otpService = new OtpService();
