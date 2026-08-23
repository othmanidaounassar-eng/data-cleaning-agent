// frontend/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    // 1. استقبال الملف
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'ملف غير صالح أو غير موجود' },
        { status: 400 }
      );
    }

    // 2. تحويل الملف إلى ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const backendFormData = new FormData();
    backendFormData.append('file', new Blob([arrayBuffer]), file.name);

    // 3. إرسال الطلب إلى الخادم الخلفي
    const response = await fetch(`${BACKEND_URL}/clean`, {
      method: 'POST',
      body: backendFormData,
    });

    // 4. قراءة الرد كـ نص أولاً
    const responseText = await response.text();

    // 5. محاولة تحليل JSON، وإذا فشلت نعيد النص كخطأ
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('❌ Backend returned non-JSON:', responseText);
      return NextResponse.json(
        { error: `Backend error: ${responseText}` },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ Proxy Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Proxy error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}