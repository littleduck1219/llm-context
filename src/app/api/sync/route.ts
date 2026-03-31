import { NextRequest, NextResponse } from 'next/server';
import {
  loadGistConfig,
  saveGistConfig,
  syncProjectContent
} from '@/lib/gist';

// 프로젝트 동기화
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const cfg = loadGistConfig();
    const project = cfg.projects[projectId];

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!cfg.githubToken) {
      return NextResponse.json({ error: 'GitHub token not configured' }, { status: 400 });
    }

    // Gist에서 최신 데이터 가져오기
    const content = await syncProjectContent(project.gistId, cfg.githubToken);

    project.lastSync = new Date().toISOString();
    saveGistConfig(cfg);

    return NextResponse.json({
      success: true,
      lastSync: project.lastSync,
      contentLength: content.length
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
  }
}
