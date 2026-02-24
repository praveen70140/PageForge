import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { UserModel } from '@/lib/models';
import { requireAuth } from '@/lib/api-utils';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

// Use AUTH_URL as the canonical base — req.nextUrl.origin resolves to localhost behind a reverse proxy
const BASE_URL = process.env.AUTH_URL || 'http://localhost:3000';

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  id: number;
  login: string;
}

// GET /api/auth/github/callback — GitHub redirects here after user authorizes
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      // User not logged in — redirect to login
      return NextResponse.redirect(new URL('/login', BASE_URL));
    }

    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const errorParam = req.nextUrl.searchParams.get('error');

    // Handle user denying access
    if (errorParam) {
      const desc = req.nextUrl.searchParams.get('error_description') || 'Authorization denied';
      return NextResponse.redirect(
        new URL(`/settings?github_error=${encodeURIComponent(desc)}`, BASE_URL)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?github_error=No+authorization+code+received', BASE_URL)
      );
    }

    // Verify state matches the current user
    if (state !== authResult.userId) {
      return NextResponse.redirect(
        new URL('/settings?github_error=Invalid+state+parameter', BASE_URL)
      );
    }

    // Exchange code for access token
    const redirectUri = new URL('/api/auth/github/callback', BASE_URL).toString();

    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = (await tokenRes.json()) as GitHubTokenResponse;

    if (tokenData.error || !tokenData.access_token) {
      const msg = tokenData.error_description || tokenData.error || 'Failed to get access token';
      return NextResponse.redirect(
        new URL(`/settings?github_error=${encodeURIComponent(msg)}`, BASE_URL)
      );
    }

    const accessToken = tokenData.access_token;

    // Fetch GitHub user info
    const userRes = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(
        new URL('/settings?github_error=Failed+to+fetch+GitHub+user+info', BASE_URL)
      );
    }

    const githubUser = (await userRes.json()) as GitHubUserResponse;

    // Store token and user info on the user record
    await connectDatabase();
    await UserModel.findByIdAndUpdate(authResult.userId, {
      $set: {
        githubAccessToken: accessToken,
        githubId: githubUser.id,
        githubUsername: githubUser.login,
        githubConnectedAt: new Date(),
      },
    });

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/settings?github_connected=true', BASE_URL)
    );
  } catch (err) {
    console.error('[GitHub OAuth callback error]', err);
    return NextResponse.redirect(
      new URL('/settings?github_error=Internal+server+error', BASE_URL)
    );
  }
}
