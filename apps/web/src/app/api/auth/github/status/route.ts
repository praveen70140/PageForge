import { NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { UserModel } from '@/lib/models';
import { requireAuth, errorResponse } from '@/lib/api-utils';

// GET /api/auth/github/status — Get current user's GitHub connection status
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    await connectDatabase();
    const user = await UserModel.findById(authResult.userId)
      .select('githubId githubUsername githubConnectedAt')
      .lean();

    if (!user) {
      return errorResponse('User not found', 404);
    }

    return NextResponse.json({
      connected: !!user.githubUsername,
      githubUsername: user.githubUsername || null,
      githubId: user.githubId || null,
      connectedAt: user.githubConnectedAt || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch GitHub status';
    return errorResponse(message, 500);
  }
}
