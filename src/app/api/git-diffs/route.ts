import { NextRequest, NextResponse } from 'next/server';
import {
  initDatabase,
  saveGitDiff,
  getGitDiffsBySession
} from '@/lib/database';

initDatabase();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const diffs = getGitDiffsBySession(sessionId);
    return NextResponse.json(diffs);
  } catch (error) {
    console.error('GET git-diffs error:', error);
    return NextResponse.json({ error: 'Failed to fetch git diffs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, sessionId, diff, summary, fromCommit, toCommit } = body;

    if (!projectId || !sessionId || !diff || !summary) {
      return NextResponse.json({ error: 'Project ID, Session ID, diff, and summary are required' }, { status: 400 });
    }

    const gitDiff = saveGitDiff(projectId, sessionId, diff, summary, {
      fromCommit,
      toCommit
    });

    return NextResponse.json(gitDiff, { status: 201 });
  } catch (error) {
    console.error('POST git-diff error:', error);
    return NextResponse.json({ error: 'Failed to save git diff' }, { status: 500 });
  }
}
