import NextAuth, { type NextAuthResult } from 'next-auth';
import { authConfig } from '@/lib/auth.config';

// Use the Edge-safe config (no Mongoose/bcrypt imports)
const nextAuth: NextAuthResult = NextAuth(authConfig);

const middleware: NextAuthResult['auth'] = nextAuth.auth;
export default middleware;

export const config = {
  // Run on all routes except static files and _next internals
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
