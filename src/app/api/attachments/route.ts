import { NextRequest, NextResponse } from 'next/server';
import { initDatabase, addAttachment, getAttachmentsByMessage } from '@/lib/database';

initDatabase();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    const attachments = getAttachmentsByMessage(messageId);
    return NextResponse.json(attachments);
  } catch (error) {
    console.error('GET attachments error:', error);
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, filename, filepath, content, language } = body;

    if (!messageId || !filename || !content) {
      return NextResponse.json({ error: 'Message ID, filename, and content are required' }, { status: 400 });
    }

    const attachment = addAttachment(messageId, { filename, filepath, content, language });
    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error('POST attachment error:', error);
    return NextResponse.json({ error: 'Failed to add attachment' }, { status: 500 });
  }
}
