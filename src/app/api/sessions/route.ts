import { NextRequest, NextResponse } from 'next/server';
import {
  loadGistConfig,
  saveGistConfig,
  getProjectContent,
  parseCloudContext,
  generateCloudMarkdown,
  updateGist,
  syncProjectContent
} from '@/lib/gist';

// 세션 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const id = searchParams.get('id');

    const cfg = loadGistConfig();

    // 특정 세션 상세 조회
    if (id && projectId) {
      const project = cfg.projects[projectId];
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const content = getProjectContent(project.gistId);
      const parsed = parseCloudContext(content);
      const session = parsed.sessions.find(s => s.date === id || s.title === id);

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      return NextResponse.json({
        id: session.date,
        projectId,
        title: session.title,
        createdAt: new Date(session.date),
        updatedAt: new Date(session.date),
        summary: '',
        tasks: session.tasks,
        codeChanges: session.codeChanges,
        errors: session.errors,
        decisions: session.decisions,
        messages: []
      });
    }

    // 프로젝트의 세션 목록 조회
    if (projectId) {
      const project = cfg.projects[projectId];
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const content = getProjectContent(project.gistId);
      const parsed = parseCloudContext(content);

      const sessions = parsed.sessions.map((s, index) => ({
        id: `${s.date}-${index}`,
        projectId,
        title: s.title,
        createdAt: new Date(s.date),
        updatedAt: new Date(s.date),
        summary: '',
        tags: [],
        messages: []
      }));

      return NextResponse.json(sessions);
    }

    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  } catch (error) {
    console.error('GET sessions error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

// 새 세션 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, title, tasks, codeChanges, errors, decisions } = body;

    if (!projectId || !title) {
      return NextResponse.json({ error: 'Project ID and title are required' }, { status: 400 });
    }

    const cfg = loadGistConfig();
    const project = cfg.projects[projectId];

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 기존 컨텍스트 로드
    const content = getProjectContent(project.gistId);
    const parsed = parseCloudContext(content);

    // 새 세션 추가
    const newSession = {
      date: new Date().toISOString().split('T')[0],
      title,
      tasks: tasks || [],
      codeChanges: codeChanges || [],
      errors: errors || [],
      decisions: decisions || []
    };

    parsed.sessions.push(newSession);

    // Gist 업데이트
    if (cfg.githubToken) {
      const newContent = generateCloudMarkdown(project.name, parsed.sessions);
      await updateGist(cfg.githubToken, project.gistId, newContent);
    }

    project.lastSync = new Date().toISOString();
    saveGistConfig(cfg);

    return NextResponse.json({
      id: `${newSession.date}-${parsed.sessions.length}`,
      projectId,
      title: newSession.title,
      createdAt: new Date(newSession.date),
      updatedAt: new Date(newSession.date)
    }, { status: 201 });
  } catch (error) {
    console.error('POST session error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

// 세션 업데이트 (요약 생성 등)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, projectId, generateSummary } = body;

    if (!sessionId || !projectId) {
      return NextResponse.json({ error: 'Session ID and Project ID are required' }, { status: 400 });
    }

    const cfg = loadGistConfig();
    const project = cfg.projects[projectId];

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const content = getProjectContent(project.gistId);
    const parsed = parseCloudContext(content);
    const session = parsed.sessions.find(s => s.date === sessionId || s.title === sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 간단한 요약 생성
    const summary = generateBasicSummary(session);

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('PUT session error:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

function generateBasicSummary(session: any): string {
  const parts: string[] = [];

  if (session.tasks?.length) {
    parts.push(`완료한 작업: ${session.tasks.length}개`);
  }
  if (session.codeChanges?.length) {
    parts.push(`코드 변경: ${session.codeChanges.length}개`);
  }
  if (session.errors?.length) {
    const resolved = session.errors.filter((e: any) => e.solution).length;
    parts.push(`에러 해결: ${resolved}/${session.errors.length}개`);
  }

  return parts.join(', ') || '세션 기록 없음';
}
