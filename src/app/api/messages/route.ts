import { NextRequest, NextResponse } from 'next/server';
import {
  loadGistConfig,
  getProjectContent,
  parseCloudContext
} from '@/lib/gist';

// 세션의 메시지 조회 (Gist에서 파싱)
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

    if (!session) {
      return NextResponse.json([]);
    }

    // Gist 기반 시스템에서는 메시지를 세션 데이터에서 변환
    // 실제 대화 내용은 저장하지 않고, 작업/코드변경/에러만 있음
    const messages = [];

    // 작업을 메시지로 변환
    if (session.tasks?.length) {
      messages.push({
        id: `${sessionId}-tasks`,
        role: 'assistant',
        content: `### 완료한 작업\n${session.tasks.map(t => `- ${t}`).join('\n')}`,
        timestamp: new Date(session.date)
      });
    }

    // 코드 변경을 메시지로 변환
    if (session.codeChanges?.length) {
      messages.push({
        id: `${sessionId}-code`,
        role: 'assistant',
        content: `### 코드 변경\n${session.codeChanges.map(c => `- ${c.file}: ${c.change}`).join('\n')}`,
        timestamp: new Date(session.date)
      });
    }

    // 에러 해결을 메시지로 변환
    if (session.errors?.length) {
      messages.push({
        id: `${sessionId}-errors`,
        role: 'assistant',
        content: `### 에러 해결\n${session.errors.map(e => `- ${e.error} → ${e.solution}`).join('\n')}`,
        timestamp: new Date(session.date)
      });
    }

    return NextResponse.json(messages);
  } catch (error) {
    console.error('GET messages error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// 메시지 저장 (Gist 시스템에서는 세션 업데이트로 처리)
export async function POST(request: NextRequest) {
  try {
    // Gist 기반 시스템에서는 개별 메시지 저장 없음
    // 세션 단위로 저장됨
    return NextResponse.json({
      message: 'Messages are stored as part of sessions in Gist-based system'
    }, { status: 200 });
  } catch (error) {
    console.error('POST message error:', error);
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
  }
}
