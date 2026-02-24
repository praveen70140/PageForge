import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Standard JSON success response.
 */
export function jsonResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Standard JSON error response.
 */
export function errorResponse(message: string, status = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Get the authenticated user's ID from the session.
 * Returns null if not authenticated.
 */
export async function getAuthUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Require authentication — returns userId or a 401 response.
 */
export async function requireAuth(): Promise<
  { userId: string; error?: never } | { userId?: never; error: NextResponse }
> {
  const userId = await getAuthUserId();
  if (!userId) {
    return { error: errorResponse('Unauthorized', 401) };
  }
  return { userId };
}

/**
 * Wrapper for async route handlers with error catching.
 */
export function withErrorHandler(
  handler: (req: Request, ctx: { params: Record<string, string> }) => Promise<NextResponse>
) {
  return async (req: Request, ctx: { params: Record<string, string> }) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      console.error(`[API Error] ${req.method} ${req.url}:`, err);
      return errorResponse(message, 500);
    }
  };
}
