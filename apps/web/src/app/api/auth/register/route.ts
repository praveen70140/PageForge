import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '@/lib/db';
import { UserModel } from '@/lib/models';
import type { RegisterInput } from '@pageforge/shared';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 12;

// POST /api/auth/register — Create a new account
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

    // ─── Create user ──────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await UserModel.create({
      name,
      email,
      passwordHash,
    });

    return NextResponse.json(
      {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[Register] Failed:', err);
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
