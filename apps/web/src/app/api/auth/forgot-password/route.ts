import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '@/lib/db';
import { UserModel } from '@/lib/models';
import { generateOTP, storeOTP } from '@/lib/otp';
import { sendPasswordResetOTP } from '@/lib/email';

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 12;

// POST /api/auth/forgot-password — Initiate password reset (send OTP) or reset password
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      action?: string;
    };

    const email = body.email?.toLowerCase().trim();
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const action = body.action || 'send-otp';

    // ─── Action: send-otp (initiate password reset) ────────────
    if (action === 'send-otp') {
      await connectDatabase();
      const user = await UserModel.findOne({ email });

      // Always return success to prevent user enumeration (FR-91)
      if (!user) {
        return NextResponse.json(
          { message: 'If that email is registered, a verification code has been sent.' },
          { status: 200 }
        );
      }

      const otp = generateOTP();
      await storeOTP(email, otp, 'forgot-password');

      try {
        await sendPasswordResetOTP(email, otp);
      } catch (emailErr) {
        console.error('[Forgot Password] Failed to send OTP email:', emailErr);
        return NextResponse.json(
          { error: 'Failed to send verification email. Please try again.' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { message: 'If that email is registered, a verification code has been sent.' },
        { status: 200 }
      );
    }

    // ─── Action: reset-password (set new password after OTP verified) ──
    if (action === 'reset-password') {
      const password = body.password;
      if (!password || password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
          { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
          { status: 400 }
        );
      }

      await connectDatabase();
      const user = await UserModel.findOne({ email });
      if (!user) {
        return NextResponse.json(
          { error: 'Account not found' },
          { status: 404 }
        );
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      user.passwordHash = passwordHash;
      await user.save();

      return NextResponse.json(
        { message: 'Password reset successfully. You can now sign in.' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (err) {
    console.error('[Forgot Password] Failed:', err);
    const message = err instanceof Error ? err.message : 'Password reset failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
