import { NextRequest, NextResponse } from 'next/server';
import { initDatabase, searchMessages } from '@/lib/database';

initDatabase();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const projectId = searchParams.get('projectId') || undefined;

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const results = searchMessages(query, projectId);
    return NextResponse.json(results);
  } catch (error) {
    console.error('GET search error:', error);
    return NextResponse.json({ error: 'Failed to search messages' }, { status: 500 });
  }
}
