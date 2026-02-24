import type { NextAuthConfig } from 'next-auth';

/**
 * Auth configuration that is safe for Edge Runtime (middleware).
 * Does NOT import mongoose, bcrypt, or any Node.js-only modules.
 * Only contains session/JWT callbacks and the authorized callback.
 */
export const authConfig: NextAuthConfig = {
  providers: [], // Providers are added in the full auth.ts

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/login',
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },

    async authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;

      // Public routes that don't require auth
      const publicPaths = ['/login', '/register'];
      const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));
      const isAuthApi = pathname.startsWith('/api/auth');

      // Allow public pages and auth API
      if (isPublicPath || isAuthApi) {
        // Redirect authenticated users away from login/register
        if (session?.user && isPublicPath) {
          return Response.redirect(new URL('/', request.nextUrl.origin));
        }
        return true;
      }

      // Everything else requires auth
      return !!session?.user;
    },
  },
};
