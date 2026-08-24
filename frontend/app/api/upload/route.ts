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

    // 2. تحويل الملف إلى ArrayBuffer ثم إلى Blob (لتجنب مشكلة duplex)
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });
    const backendFormData = new FormData();
    backendFormData.append('file', blob, file.name);

    // 3. إرسال الطلب إلى الخادم الخلفي مع إعدادات إضافية
    const response = await fetch(`${BACKEND_URL}/clean`, {
      method: 'POST',
      body: backendFormData,
      // ✅ حل مشكلة duplex في Next.js (ضروري في بيئة Vercel)
      duplex: 'half',
      // ✅ زيادة المهلة لتجنب انقطاع الاتصال للملفات الكبيرة
      signal: AbortSignal.timeout(300000), // 5 دقائق
    });

    // 4. قراءة الرد كـ نص أولاً، مع تحقق من نوع المحتوى
    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || '';

    // 5. إذا كان الرد غير JSON، نعيده كخطأ واضح
    if (!contentType.includes('application/json')) {
      console.error('❌ Backend returned non-JSON:', responseText);
      return NextResponse.json(
        { error: `Backend error: ${responseText || 'Unknown response'}` },
        { status: response.status }
      );
    }

    // 6. محاولة تحليل JSON
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

    // 7. إعادة الرد الناجح
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('❌ Proxy Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // معالجة أخطاء المهلة (Timeout)
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'الخادم الخلفي استغرق وقتاً طويلاً في المعالجة. حاول مرة أخرى.' },
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