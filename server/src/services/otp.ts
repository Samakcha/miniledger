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

export const DEMO_OTP = '123456';

/**
 * Checks whether demo OTP mode is explicitly enabled via environment variable.
 * Must be explicitly set to 'true'; defaults to false otherwise.
 */
export function isDemoOtpEnabled(): boolean {
  return process.env.DEMO_OTP_ENABLED?.trim().toLowerCase() === 'true';
}

export interface RequestOtpResult {
  success: boolean;
  error?: string;
  status?: number;
  demoMode?: boolean;
  message?: string;
}

export interface VerifyOtpResult {
  valid: boolean;
  error?: string;
  status?: number;
}

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
  private demoVerifyAttemptStore = new Map<string, { attempts: number; windowStart: number; lockedUntil?: number }>();

  /**
   * Generates a cryptographically secure 6-digit OTP and stores it.
   * When demo mode is explicitly enabled, enforces rate limiting but does not require
   * in-memory storage, returning a clear demo indication.
   */
  public requestOtp(
    normalizedPhone: string,
    options?: { customTtlMs?: number }
  ): RequestOtpResult {
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

    // If demo mode is active, do not require persistent in-memory OTP storage
    if (isDemoOtpEnabled()) {
      console.log(`[AUTH] Demo OTP requested for ${normalizedPhone}. Demo authentication active.`);
      return {
        success: true,
        demoMode: true,
        message: 'Demo mode is active. Please enter the demo verification code to continue.',
      };
    }

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
   * Explicitly enabled demo verification path.
   * Only active when DEMO_OTP_ENABLED=true.
   * Accepts DEMO_OTP ('123456') without requiring in-memory storage,
   * while enforcing abuse protection (max 5 failed attempts lockout per 10-minute window).
   */
  public verifyDemoOtp(
    normalizedPhone: string,
    inputOtp: string
  ): VerifyOtpResult {
    if (!inputOtp || typeof inputOtp !== 'string') {
      return { valid: false, status: 400, error: 'OTP is required' };
    }

    const trimmedOtp = inputOtp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      return { valid: false, status: 400, error: 'OTP must be a 6-digit number' };
    }

    if (!isDemoOtpEnabled()) {
      return { valid: false, status: 403, error: 'Demo mode is not enabled' };
    }

    const now = Date.now();
    const DEMO_LOCKOUT_MS = 10 * 60 * 1000;
    const DEMO_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
    const MAX_DEMO_ATTEMPTS = 5;

    let tracker = this.demoVerifyAttemptStore.get(normalizedPhone);
    if (tracker) {
      if (tracker.lockedUntil && now < tracker.lockedUntil) {
        return {
          valid: false,
          status: 429,
          error: 'Maximum verification attempts exceeded. Please wait before trying again.',
        };
      }
      if (now - tracker.windowStart > DEMO_ATTEMPT_WINDOW_MS) {
        tracker = { attempts: 0, windowStart: now };
        this.demoVerifyAttemptStore.set(normalizedPhone, tracker);
      }
    } else {
      tracker = { attempts: 0, windowStart: now };
      this.demoVerifyAttemptStore.set(normalizedPhone, tracker);
    }

    // Constant-time comparison against DEMO_OTP
    const isDemoMatch = this.timingSafeEqual(DEMO_OTP, trimmedOtp);
    if (isDemoMatch) {
      tracker.attempts = 0;
      delete tracker.lockedUntil;
      return { valid: true };
    }

    // Check if a real OTP exists in memory and matches (fallback for local developers)
    const realRecord = this.otpStore.get(normalizedPhone);
    if (realRecord && now <= realRecord.expiresAt && realRecord.attempts < MAX_VERIFY_ATTEMPTS) {
      if (this.timingSafeEqual(realRecord.otp, trimmedOtp)) {
        this.otpStore.delete(normalizedPhone);
        tracker.attempts = 0;
        delete tracker.lockedUntil;
        return { valid: true };
      }
    }

    // Failed attempt: increment tracker
    tracker.attempts += 1;
    if (tracker.attempts >= MAX_DEMO_ATTEMPTS) {
      tracker.lockedUntil = now + DEMO_LOCKOUT_MS;
      return {
        valid: false,
        status: 429,
        error: 'Maximum verification attempts exceeded. Please wait before trying again.',
      };
    }

    const remainingAttempts = MAX_DEMO_ATTEMPTS - tracker.attempts;
    return {
      valid: false,
      status: 400,
      error: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
    };
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
    this.demoVerifyAttemptStore.clear();
  }
}

export const otpService = new OtpService();
