import crypto from 'crypto';
import { getRedisClient } from '@/lib/redis';

// ─── OTP Configuration ──────────────────────────────────────────

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 5 * 60; // 5 minutes
const OTP_PREFIX = 'otp:';
const PENDING_REG_PREFIX = 'pending-reg:';
const PENDING_REG_EXPIRY_SECONDS = 10 * 60; // 10 minutes (slightly longer than OTP)

// ─── OTP Generation & Verification ──────────────────────────────

/**
 * Generate a cryptographically random 6-digit OTP.
 */
export function generateOTP(): string {
  // Generate a random number 0–999999, zero-padded to 6 digits
  const num = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return num.toString().padStart(OTP_LENGTH, '0');
}

/**
 * Store an OTP in Redis with a 5-minute TTL.
 * Key format: otp:{purpose}:{email}
 * Overwrites any existing OTP for the same purpose+email (resend).
 */
export async function storeOTP(
  email: string,
  otp: string,
  purpose: 'register' | 'forgot-password'
): Promise<void> {
  const redis = getRedisClient();
  const key = `${OTP_PREFIX}${purpose}:${email}`;
  await redis.set(key, otp, 'EX', OTP_EXPIRY_SECONDS);
}

/**
 * Verify an OTP. Returns true if valid, false if expired/invalid.
 * Deletes the OTP on successful verification (single-use).
 */
export async function verifyOTP(
  email: string,
  otp: string,
  purpose: 'register' | 'forgot-password'
): Promise<boolean> {
  const redis = getRedisClient();
  const key = `${OTP_PREFIX}${purpose}:${email}`;
  const stored = await redis.get(key);

  if (!stored || stored !== otp) {
    return false;
  }

  // Single-use: delete after successful verification
  await redis.del(key);
  return true;
}

// ─── Pending Registration Storage ───────────────────────────────
// Stores registration data temporarily until OTP is verified.
// This avoids creating the user in MongoDB before email is confirmed.

export interface PendingRegistration {
  name: string;
  email: string;
  passwordHash: string;
}

/**
 * Store pending registration data in Redis.
 */
export async function storePendingRegistration(
  email: string,
  data: PendingRegistration
): Promise<void> {
  const redis = getRedisClient();
  const key = `${PENDING_REG_PREFIX}${email}`;
  await redis.set(key, JSON.stringify(data), 'EX', PENDING_REG_EXPIRY_SECONDS);
}

/**
 * Retrieve and delete pending registration data (consume on use).
 */
export async function consumePendingRegistration(
  email: string
): Promise<PendingRegistration | null> {
  const redis = getRedisClient();
  const key = `${PENDING_REG_PREFIX}${email}`;
  const raw = await redis.get(key);

  if (!raw) {
    return null;
  }

  await redis.del(key);
  return JSON.parse(raw) as PendingRegistration;
}

/**
 * Check if a pending registration exists (without consuming it).
 */
export async function hasPendingRegistration(email: string): Promise<boolean> {
  const redis = getRedisClient();
  const key = `${PENDING_REG_PREFIX}${email}`;
  return (await redis.exists(key)) === 1;
}
