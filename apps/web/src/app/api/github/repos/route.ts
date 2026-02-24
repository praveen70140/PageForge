import { NextRequest, NextResponse } from 'next/server';
import { connectDatabase } from '@/lib/db';
import { UserModel } from '@/lib/models';
import { requireAuth, errorResponse, jsonResponse } from '@/lib/api-utils';

const GITHUB_API_URL = 'https://api.github.com';

interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
  description: string | null;
  language: string | null;
  updated_at: string;
}

export interface RepoListItem {
  id: number;
  fullName: string;
  name: string;
  isPrivate: boolean;
  cloneUrl: string;
  defaultBranch: string;
  description: string | null;
  language: string | null;
  updatedAt: string;
}

// GET /api/github/repos — List the authenticated user's GitHub repos
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    await connectDatabase();

    // Fetch user with their GitHub token
    const user = await UserModel.findById(authResult.userId).select('+githubAccessToken');
    if (!user || !user.githubAccessToken) {
      return errorResponse('GitHub account not connected. Connect your GitHub account first.', 400);
    }

    // Pagination params
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '30', 10), 100);
    const sort = searchParams.get('sort') || 'updated'; // updated, pushed, full_name, created
    const query = searchParams.get('q') || '';

    let repos: RepoListItem[];

    if (query) {
      // Use search API for filtering
      const searchRes = await fetch(
        `${GITHUB_API_URL}/search/repositories?q=${encodeURIComponent(query)}+user:${user.githubUsername}&sort=${sort}&per_page=${perPage}&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${user.githubAccessToken}`,
            Accept: 'application/vnd.github+json',
          },
        }
      );

      if (searchRes.status === 401) {
        return errorResponse('GitHub token expired or revoked. Please reconnect your GitHub account.', 401);
      }

      if (!searchRes.ok) {
        return errorResponse('Failed to search GitHub repositories', 502);
      }

      const searchData = (await searchRes.json()) as { items: GitHubRepo[] };
      repos = searchData.items.map(mapRepo);
    } else {
      // List all repos the user has access to
      const reposRes = await fetch(
        `${GITHUB_API_URL}/user/repos?sort=${sort}&direction=desc&per_page=${perPage}&page=${page}&affiliation=owner,collaborator,organization_member`,
        {
          headers: {
            Authorization: `Bearer ${user.githubAccessToken}`,
            Accept: 'application/vnd.github+json',
          },
        }
      );

      if (reposRes.status === 401) {
        return errorResponse('GitHub token expired or revoked. Please reconnect your GitHub account.', 401);
      }

      if (!reposRes.ok) {
        return errorResponse('Failed to fetch GitHub repositories', 502);
      }

      const reposData = (await reposRes.json()) as GitHubRepo[];
      repos = reposData.map(mapRepo);
    }

    return jsonResponse(repos);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch repositories';
    return errorResponse(message, 500);
  }
}

function mapRepo(repo: GitHubRepo): RepoListItem {
  return {
    id: repo.id,
    fullName: repo.full_name,
    name: repo.name,
    isPrivate: repo.private,
    cloneUrl: repo.clone_url,
    defaultBranch: repo.default_branch,
    description: repo.description,
    language: repo.language,
    updatedAt: repo.updated_at,
  };
}
