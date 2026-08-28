// frontend/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';

// 🔥 Changed fallback port from 8000 to 8001
const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:8001';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'ملف غير صالح أو غير موجود' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });
    const backendFormData = new FormData();
    backendFormData.append('file', blob, file.name);

    const response = await fetch(`${BACKEND_URL}/clean`, {
      method: 'POST',
      body: backendFormData,
      signal: AbortSignal.timeout(300000),
    });

    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      console.error('❌ Backend returned non-JSON:', responseText);
      return NextResponse.json(
        { error: `Backend error: ${responseText || 'Unknown response'}` },
        { status: response.status }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return NextResponse.json(
        { error: `Invalid JSON from backend: ${responseText.substring(0, 200)}` },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ Proxy Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'الخادم الخلفي استغرق وقتاً طويلاً. حاول مرة أخرى.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: `Proxy error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}