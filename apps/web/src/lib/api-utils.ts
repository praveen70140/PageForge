import { NextResponse } from 'next/server';

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
