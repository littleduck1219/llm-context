import { NextRequest, NextResponse } from 'next/server';
import {
  loadGistConfig,
  getProjectContent,
  parseCloudContext
} from '@/lib/gist';

// LLM용 컨텍스트 생성
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const sessionId = searchParams.get('sessionId');
    const format = searchParams.get('format') || 'json';

    const cfg = loadGistConfig();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const project = cfg.projects[projectId];
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const content = getProjectContent(project.gistId);
    const parsed = parseCloudContext(content);

    if (format === 'llm') {
      // LLM 프롬프트용 텍스트 형식
      const text = generateLLMContext(parsed, sessionId);
      return new NextResponse(text, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // JSON 형식
    return NextResponse.json({
      projectName: parsed.projectName,
      summary: parsed.summary,
      sessions: parsed.sessions,
      totalSessions: parsed.sessions.length
    });
  } catch (error) {
    console.error('GET context error:', error);
    return NextResponse.json({ error: 'Failed to generate context' }, { status: 500 });
  }
}

function generateLLMContext(parsed: ReturnType<typeof parseCloudContext>, sessionId?: string | null): string {
  const lines: string[] = [];

  lines.push('# 이전 개발 세션 컨텍스트');
  lines.push('');
  lines.push(`## 프로젝트: ${parsed.projectName}`);
  lines.push('');

  if (parsed.summary) {
    lines.push('### 프로젝트 요약');
    lines.push(parsed.summary.trim());
    lines.push('');
  }

  // 특정 세션만 요청한 경우
  if (sessionId) {
    const session = parsed.sessions.find(s => s.date === sessionId || s.title === sessionId);
    if (session) {
      lines.push(...formatSession(session));
      return lines.join('\n');
    }
  }

  // 최근 세션들 (최대 5개)
  const recentSessions = parsed.sessions.slice(-5);
  for (const session of recentSessions) {
    lines.push(...formatSession(session));
  }

  return lines.join('\n');
}

function formatSession(session: any): string[] {
  const lines: string[] = [];

  lines.push(`---`);
  lines.push('');
  lines.push(`## 세션: ${session.title} [${session.date}]`);
  lines.push('');

  if (session.tasks?.length) {
    lines.push('### 완료한 작업');
    session.tasks.forEach((t: string) => lines.push(`- ${t}`));
    lines.push('');
  }

  if (session.codeChanges?.length) {
    lines.push('### 코드 변경');
    session.codeChanges.forEach((c: any) => lines.push(`- ${c.file}: ${c.change}`));
    lines.push('');
  }

  if (session.errors?.length) {
    const resolved = session.errors.filter((e: any) => e.solution);
    if (resolved.length > 0) {
      lines.push('### 해결된 에러');
      resolved.forEach((e: any) => {
        lines.push(`- **에러**: ${e.error}`);
        lines.push(`  **해결**: ${e.solution}`);
      });
      lines.push('');
    }
  }

  if (session.decisions?.length) {
    lines.push('### 결정사항');
    session.decisions.forEach((d: string) => lines.push(`- ${d}`));
    lines.push('');
  }

  return lines;
}
