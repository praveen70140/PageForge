import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { UserModel } from '@/lib/models';
import { verifyOTP, consumePendingRegistration } from '@/lib/otp';

// POST /api/auth/otp/verify — Verify OTP for registration or forgot-password
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      email?: string;
      otp?: string;
      purpose?: string;
    };

    if (!body.email || !body.otp || !body.purpose) {
      return NextResponse.json(
        { error: 'Email, OTP, and purpose are required' },
        { status: 400 }
      );
    }

    const email = body.email.toLowerCase().trim();
    const otp = body.otp.trim();
    const purpose = body.purpose as 'register' | 'forgot-password';

    if (purpose !== 'register' && purpose !== 'forgot-password') {
      return NextResponse.json(
        { error: 'Invalid purpose' },
        { status: 400 }
      );
    }

    // ─── Verify the OTP ────────────────────────────────────────
    const isValid = await verifyOTP(email, otp, purpose);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    // ─── Handle based on purpose ───────────────────────────────

    if (purpose === 'register') {
      // Consume pending registration and create the actual user
      const pending = await consumePendingRegistration(email);
      if (!pending) {
        return NextResponse.json(
          { error: 'Registration data expired. Please register again.' },
          { status: 400 }
        );
      }

      await connectDatabase();

      // Double-check email uniqueness (race condition guard)
      const existing = await UserModel.findOne({ email });
      if (existing) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        );
      }

      const user = await UserModel.create({
        name: pending.name,
        email: pending.email,
        passwordHash: pending.passwordHash,
        emailVerified: true,
      });

      return NextResponse.json(
        {
          message: 'Account created successfully',
          user: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
          },
        },
        { status: 201 }
      );
    }

    // purpose === 'forgot-password'
    // OTP is verified — return success so the client can show the new password form
    return NextResponse.json(
      { message: 'Code verified. You can now reset your password.', verified: true },
      { status: 200 }
    );
  } catch (err) {
    console.error('[OTP Verify] Failed:', err);
    const message = err instanceof Error ? err.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
