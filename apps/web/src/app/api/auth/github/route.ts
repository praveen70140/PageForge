import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { UserModel } from '@/lib/models';
import { requireAuth, errorResponse, jsonResponse } from '@/lib/api-utils';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';

// GET /api/auth/github — Redirect user to GitHub OAuth consent screen
export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  if (!GITHUB_CLIENT_ID) {
    return errorResponse('GitHub OAuth is not configured. Set GITHUB_CLIENT_ID in your environment.', 500);
  }

  // Build the OAuth authorization URL
  const redirectUri = new URL('/api/auth/github/callback', req.nextUrl.origin).toString();
  const state = authResult.userId; // We pass userId as state so the callback knows which user to update

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'repo',  // Read access to private repos
    state,
  });

  const authorizeUrl = `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
  return NextResponse.redirect(authorizeUrl);
}

// DELETE /api/auth/github — Disconnect GitHub account
export async function DELETE() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    await connectDatabase();
    await UserModel.findByIdAndUpdate(authResult.userId, {
      $unset: {
        githubAccessToken: 1,
        githubId: 1,
        githubUsername: 1,
        githubConnectedAt: 1,
      },
    });

    return jsonResponse({ disconnected: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to disconnect GitHub';
    return errorResponse(message, 500);
  }
}
