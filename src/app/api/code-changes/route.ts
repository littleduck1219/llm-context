import { NextRequest, NextResponse } from 'next/server';
import {
  loadGistConfig,
  getProjectContent,
  parseCloudContext
} from '@/lib/gist';

// 세션의 코드 변경 조회 (Gist에서 파싱)
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

    if (!session || !session.codeChanges?.length) {
      return NextResponse.json([]);
    }

    // Gist 형식을 UI 형식으로 변환
    const codeChanges = session.codeChanges.map((c, index) => ({
      id: `${sessionId}-code-${index}`,
      sessionId,
      messageId: `${sessionId}-code-${index}`,
      filepath: c.file,
      changeType: 'modified' as const,
      description: c.change,
      createdAt: new Date(session.date)
    }));

    return NextResponse.json(codeChanges);
  } catch (error) {
    console.error('GET code-changes error:', error);
    return NextResponse.json({ error: 'Failed to fetch code changes' }, { status: 500 });
  }
}

// 코드 변경 저장 (세션 업데이트로 처리)
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({
      message: 'Code changes are stored as part of sessions in Gist-based system'
    }, { status: 200 });
  } catch (error) {
    console.error('POST code-change error:', error);
    return NextResponse.json({ error: 'Failed to save code change' }, { status: 500 });
  }
}
