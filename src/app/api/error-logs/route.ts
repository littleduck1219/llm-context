import { NextRequest, NextResponse } from 'next/server';
import {
  loadGistConfig,
  getProjectContent,
  parseCloudContext
} from '@/lib/gist';

// 세션의 에러 로그 조회 (Gist에서 파싱)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const projectId = searchParams.get('projectId');

    if (!sessionId || !projectId) {
      return NextResponse.json({ error: 'Session ID and Project ID are required' }, { status: 400 });
    }

    const cfg = loadGistConfig();
    const project = cfg.projects[projectId];

    if (!project) {
      return NextResponse.json([]);
    }

    const content = getProjectContent(project.gistId);
    const parsed = parseCloudContext(content);
    const session = parsed.sessions.find(s => s.date === sessionId || s.title === sessionId);

    if (!session || !session.errors?.length) {
      return NextResponse.json([]);
    }

    // Gist 형식을 UI 형식으로 변환
    const errorLogs = session.errors.map((e, index) => ({
      id: `${sessionId}-error-${index}`,
      sessionId,
      messageId: `${sessionId}-error-${index}`,
      errorType: 'Error',
      errorMessage: e.error,
      solution: e.solution,
      createdAt: new Date(session.date),
      solvedAt: e.solution ? new Date(session.date) : undefined
    }));

    return NextResponse.json(errorLogs);
  } catch (error) {
    console.error('GET error-logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch error logs' }, { status: 500 });
  }
}

// 에러 로그 저장 (세션 업데이트로 처리)
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({
      message: 'Error logs are stored as part of sessions in Gist-based system'
    }, { status: 200 });
  } catch (error) {
    console.error('POST error-log error:', error);
    return NextResponse.json({ error: 'Failed to add error log' }, { status: 500 });
  }
}
