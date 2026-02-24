import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// ─── SMTP Configuration ─────────────────────────────────────────

// Lazy-initialised so env vars are guaranteed to be loaded before use
let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });
  }
  return _transporter;
}

function getFromAddress(): string {
  return process.env.SMTP_FROM || 'PageForge <noreply@pageforge.local>';
}

// ─── Email Templates ────────────────────────────────────────────

/**
 * Send an OTP email for registration email verification.
 */
export async function sendRegistrationOTP(
  email: string,
  otp: string
): Promise<void> {
  await getTransporter().sendMail({
    from: getFromAddress(),
    to: email,
    subject: 'Verify your email — PageForge',
    text: `Your verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #f4f4f5; margin-bottom: 8px;">Verify your email</h2>
        <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 24px;">Enter this code to complete your PageForge registration:</p>
        <div style="background: #18181b; border: 1px solid #3f3f46; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #f4f4f5;">${otp}</span>
        </div>
        <p style="color: #71717a; font-size: 12px;">This code expires in 5 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `,
  });
}

/**
 * Send an OTP email for password reset.
 */
export async function sendPasswordResetOTP(
  email: string,
  otp: string
): Promise<void> {
  await getTransporter().sendMail({
    from: getFromAddress(),
    to: email,
    subject: 'Reset your password — PageForge',
    text: `Your password reset code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #f4f4f5; margin-bottom: 8px;">Reset your password</h2>
        <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 24px;">Enter this code to reset your PageForge password:</p>
        <div style="background: #18181b; border: 1px solid #3f3f46; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #f4f4f5;">${otp}</span>
        </div>
        <p style="color: #71717a; font-size: 12px;">This code expires in 5 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `,
  });
}
