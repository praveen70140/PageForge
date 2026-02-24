import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '@/lib/db';
import { UserModel } from '@/lib/models';
import { generateOTP, storeOTP, storePendingRegistration } from '@/lib/otp';
import { sendRegistrationOTP } from '@/lib/email';
import type { RegisterInput } from '@pageforge/shared';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 12;

// POST /api/auth/register — Initiate registration (sends OTP, does NOT create user yet)
export async function POST(req: NextRequest) {
  try {
    await connectDatabase();
    const body = (await req.json()) as RegisterInput;

    // ─── Validation ────────────────────────────────────────────
    if (!body.name || !body.email || !body.password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    const name = body.name.trim();
    const email = body.email.toLowerCase().trim();
    const password = body.password;

    if (name.length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    // ─── Check for existing user ───────────────────────────────
    const existing = await UserModel.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // ─── Store pending registration + send OTP ─────────────────
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await storePendingRegistration(email, {
      name,
      email,
      passwordHash,
    });

    const otp = generateOTP();
    await storeOTP(email, otp, 'register');

    try {
      await sendRegistrationOTP(email, otp);
    } catch (emailErr) {
      console.error('[Register] Failed to send OTP email:', emailErr);
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Verification code sent to your email', email },
      { status: 200 }
    );
  } catch (err) {
    console.error('[Register] Failed:', err);
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
