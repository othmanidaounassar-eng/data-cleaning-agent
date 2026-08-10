import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard'];
const authRoutes = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  const { pathname } = request.nextUrl;

  // تجاهل الملفات الثابتة
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon.ico') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // إذا كان المسار محمياً وليس هناك توكن → إعادة توجيه إلى /login
  if (protectedRoutes.some(route => pathname.startsWith(route)) && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // إذا كان المستخدم مسجلاً ويحاول الدخول إلى login/register → إعادة توجيه إلى /dashboard
  if (authRoutes.includes(pathname) && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};