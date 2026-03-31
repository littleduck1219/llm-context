import { NextRequest, NextResponse } from 'next/server';
import { initDatabase, exportProject } from '@/lib/database';

initDatabase();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const format = (searchParams.get('format') as 'json' | 'markdown') || 'markdown';

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const content = exportProject(projectId, format);

    const contentType = format === 'json'
      ? 'application/json'
      : 'text/markdown';

    const filename = `project-export-${projectId}.${format === 'json' ? 'json' : 'md'}`;

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    console.error('GET export error:', error);
    return NextResponse.json({ error: 'Failed to export project' }, { status: 500 });
  }
}
