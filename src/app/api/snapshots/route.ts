import { NextRequest, NextResponse } from 'next/server';
import {
  initDatabase,
  createSnapshot,
  getSnapshotsByProject,
  getSnapshot
} from '@/lib/database';
import fs from 'fs';
import path from 'path';

initDatabase();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const id = searchParams.get('id');

    if (id) {
      const snapshot = getSnapshot(id);
      if (!snapshot) {
        return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
      }
      return NextResponse.json(snapshot);
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const snapshots = getSnapshotsByProject(projectId);
    return NextResponse.json(snapshots);
  } catch (error) {
    console.error('GET snapshots error:', error);
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const projectId = formData.get('projectId') as string;
    const label = formData.get('label') as string;
    const description = formData.get('description') as string | null;
    const sessionId = formData.get('sessionId') as string | null;
    const filesData = formData.get('files') as string;

    if (!projectId || !label) {
      return NextResponse.json({ error: 'Project ID and label are required' }, { status: 400 });
    }

    // files가 JSON 문자열로 전달된 경우 파싱
    let files = [];
    if (filesData) {
      try {
        files = JSON.parse(filesData);
      } catch {
        return NextResponse.json({ error: 'Invalid files data' }, { status: 400 });
      }
    }

    const snapshot = createSnapshot(projectId, label, files, {
      sessionId: sessionId || undefined,
      description: description || undefined
    });

    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    console.error('POST snapshot error:', error);
    return NextResponse.json({ error: 'Failed to create snapshot' }, { status: 500 });
  }
}
