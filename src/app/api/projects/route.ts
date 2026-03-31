import { NextRequest, NextResponse } from 'next/server';
import {
  loadGistConfig,
  saveGistConfig,
  getProjects,
  createGist,
  generateCloudMarkdown,
  syncProjectContent
} from '@/lib/gist';

// 프로젝트 목록 조회
export async function GET(request: NextRequest) {
  try {
    const cfg = loadGistConfig();

    // 토큰이 있으면 모든 프로젝트 동기화
    if (cfg.githubToken) {
      for (const [projectPath, project] of Object.entries(cfg.projects)) {
        try {
          await syncProjectContent(project.gistId, cfg.githubToken);
          cfg.projects[projectPath].lastSync = new Date().toISOString();
        } catch {
          // 동기화 실패해도 캐시 데이터 사용
        }
      }
      saveGistConfig(cfg);
    }

    const projects = getProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('GET projects error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// 새 프로젝트 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, path: projectPath, description } = body;

    if (!name || !projectPath) {
      return NextResponse.json({ error: 'Name and path are required' }, { status: 400 });
    }

    const cfg = loadGistConfig();

    // 이미 존재하는지 확인
    if (cfg.projects[projectPath]) {
      return NextResponse.json(cfg.projects[projectPath]);
    }

    // GitHub 토큰이 없으면 로컬만 저장
    if (!cfg.githubToken) {
      const projectData = {
        id: projectPath,
        name,
        path: projectPath,
        description,
        gistId: '',
        lastSync: new Date().toISOString()
      };
      return NextResponse.json(projectData);
    }

    // Gist 생성
    const initialContent = generateCloudMarkdown(name, [], description);
    const gistId = await createGist(cfg.githubToken, name, initialContent);

    // 설정 저장
    cfg.projects[projectPath] = {
      name,
      gistId,
      lastSync: new Date().toISOString()
    };
    saveGistConfig(cfg);

    return NextResponse.json({
      id: projectPath,
      name,
      path: projectPath,
      description,
      gistId,
      lastSync: cfg.projects[projectPath].lastSync,
      gistUrl: `https://gist.github.com/${gistId}`
    }, { status: 201 });
  } catch (error) {
    console.error('POST project error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

// 프로젝트 요약 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, memory } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const cfg = loadGistConfig();
    const project = cfg.projects[projectId];

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 요약 업데이트는 Gist에서 직접 처리
    project.lastSync = new Date().toISOString();
    saveGistConfig(cfg);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT project error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}
