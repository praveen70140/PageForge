import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { UserModel } from '@/lib/models';
import {
  generateOTP,
  storeOTP,
  hasPendingRegistration,
} from '@/lib/otp';
import { sendRegistrationOTP, sendPasswordResetOTP } from '@/lib/email';

// POST /api/auth/otp/send — Resend OTP for registration or forgot-password
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; purpose?: string };

    if (!body.email || !body.purpose) {
      return NextResponse.json(
        { error: 'Email and purpose are required' },
        { status: 400 }
      );
    }

    const email = body.email.toLowerCase().trim();
    const purpose = body.purpose as 'register' | 'forgot-password';

    if (purpose !== 'register' && purpose !== 'forgot-password') {
      return NextResponse.json(
        { error: 'Invalid purpose' },
        { status: 400 }
      );
    }

    // ─── Validate context ──────────────────────────────────────
    if (purpose === 'register') {
      // Only resend if there's a pending registration
      const hasPending = await hasPendingRegistration(email);
      if (!hasPending) {
        return NextResponse.json(
          { error: 'No pending registration found. Please register again.' },
          { status: 400 }
        );
      }
    }

    if (purpose === 'forgot-password') {
      // Silently succeed even if email doesn't exist (prevent user enumeration per FR-91)
      await connectDatabase();
      const user = await UserModel.findOne({ email });
      if (!user) {
        // Return success to prevent user enumeration
        return NextResponse.json(
          { message: 'If that email is registered, a verification code has been sent.' },
          { status: 200 }
        );
      }
    }

    // ─── Generate and send new OTP ─────────────────────────────
    const otp = generateOTP();
    await storeOTP(email, otp, purpose);

    try {
      if (purpose === 'register') {
        await sendRegistrationOTP(email, otp);
      } else {
        await sendPasswordResetOTP(email, otp);
      }
    } catch (emailErr) {
      console.error(`[OTP Send] Failed to send ${purpose} OTP:`, emailErr);
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      );
    }

    const message =
      purpose === 'register'
        ? 'Verification code sent to your email'
        : 'If that email is registered, a verification code has been sent.';

    return NextResponse.json({ message }, { status: 200 });
  } catch (err) {
    console.error('[OTP Send] Failed:', err);
    const message = err instanceof Error ? err.message : 'Failed to send OTP';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
