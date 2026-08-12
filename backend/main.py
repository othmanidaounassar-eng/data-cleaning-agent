import os
import shutil
import time
import traceback
import base64
from io import BytesIO
from typing import Optional

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from config import (
    UPLOAD_FOLDER, OUTPUT_FOLDER, CORS_ORIGINS,
    RATE_LIMIT_REQUESTS, RATE_LIMIT_PERIOD, ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS, ALLOWED_EXTENSIONS
)
from reader import read_data
from analyzer import analyze_data
from cleaner import clean_data
from report import generate_report
from exporter import save_output
from database import engine, Base, get_db
from models import User
from schemas import UserCreate, UserOut, Token, RefreshTokenRequest
from auth import (
    create_access_token,
    create_refresh_token,
    verify_password,
    get_user_by_email,
    create_user,
    decode_refresh_token,
    get_current_active_user,
)
from rate_limiter import setup_rate_limiter, limiter

# ============================================
# 1. إنشاء جداول قاعدة البيانات
# ============================================
Base.metadata.create_all(bind=engine)

# ============================================
# 2. إنشاء تطبيق FastAPI
# ============================================
app = FastAPI(
    title="AI Data Cleaning Agent",
    version="1.0",
    description="Secure data cleaning with JWT authentication.",
)

# ============================================
# 3. تفعيل Rate Limiting
# ============================================
setup_rate_limiter(app)


# ============================================
# 4. إضافة رؤوس الأمان (CSP, X-Frame-Options, إلخ)
# ============================================
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://data-cleaning-agent-production.up.railway.app; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "base-uri 'self'; "
        "upgrade-insecure-requests;"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ============================================
# 5. CORS (مقيد بالنطاقات المسموح بها)
# ============================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Content-Disposition"],
    max_age=86400,
)

# ============================================
# 6. إنشاء مجلدات التحميل
# ============================================
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)


# ============================================
# 7. دالة مساعدة: تحويل DataFrame إلى Base64
# ============================================
def dataframe_to_base64(df: pd.DataFrame) -> str:
    buffer = BytesIO()
    df.to_csv(buffer, index=False, encoding='utf-8-sig')
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


# ============================================
# 8. نقاط نهاية المصادقة (محمية بـ Rate Limiting)
# ============================================

@app.post("/auth/register", response_model=UserOut, status_code=201)
@limiter.limit(f"{RATE_LIMIT_REQUESTS}/{RATE_LIMIT_PERIOD}seconds")
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    """تسجيل مستخدم جديد."""
    return create_user(db, user)


@app.post("/auth/login", response_model=Token)
@limiter.limit(f"{RATE_LIMIT_REQUESTS}/{RATE_LIMIT_PERIOD}seconds")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """تسجيل الدخول مع سجلات التصحيح."""
    email = form_data.username.lower()

    # ✅ سجلات التصحيح (تظهر في Railway logs)
    print(f"[DEBUG] Login attempt for email: {email}")

    user = get_user_by_email(db, email)
    if user:
        print(f"[DEBUG] User found: {user.email}")
        print(f"[DEBUG] Stored hash (first 20 chars): {user.hashed_password[:20]}...")
    else:
        print(f"[DEBUG] User NOT found for email: {email}")
        raise HTTPException(401, "Incorrect email or password.")

    # التحقق من كلمة المرور
    password_valid = verify_password(form_data.password, user.hashed_password)
    print(f"[DEBUG] Password valid: {password_valid}")

    if not password_valid:
        print("[DEBUG] Password verification failed.")
        raise HTTPException(401, "Incorrect email or password.")

    print("[DEBUG] Login successful, generating tokens.")

    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})

    response = JSONResponse({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    })
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/auth/refresh",
    )
    return response


@app.post("/auth/refresh", response_model=Token)
def refresh_token(
        request: Request,
        request_data: Optional[RefreshTokenRequest] = None,
        db: Session = Depends(get_db)
):
    """
    تجديد التوكنات باستخدام Refresh Token.
    """
    refresh_token = None
    if request_data and request_data.refresh_token:
        refresh_token = request_data.refresh_token
    else:
        refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(status_code=400, detail="Refresh token is required")

    token_data = decode_refresh_token(refresh_token)
    if token_data is None or token_data.email is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = get_user_by_email(db, token_data.email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_access_token = create_access_token(data={"sub": user.email})
    new_refresh_token = create_refresh_token(data={"sub": user.email})

    response = JSONResponse({
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    })
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/auth/refresh",
    )
    return response


@app.post("/logout")
def logout():
    response = JSONResponse({"message": "Logged out successfully"})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/auth/refresh")
    return response


@app.get("/auth/me", response_model=UserOut)
def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user


# ============================================
# 9. نقطة تنظيف البيانات (محمية بالمصادقة)
# ============================================

@app.post("/clean")
def clean_dataset(
        request: Request,
        file: UploadFile = File(...),
        current_user: User = Depends(get_current_active_user),
):
    start_time = time.time()
    try:
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

        MAX_FILE_SIZE = 50 * 1024 * 1024
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(413, "File too large. Maximum size is 50 MB.")

        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        df = read_data(file_path)
        before = analyze_data(df)
        cleaned_df, cleaning_report = clean_data(df)
        after = analyze_data(cleaned_df)
        _ = save_output(cleaned_df, OUTPUT_FOLDER, file.filename)

        execution_time = time.time() - start_time
        report = generate_report(before, after, cleaning_report, execution_time)

        csv_bytes = dataframe_to_base64(cleaned_df)
        report["download_url"] = f"data:text/csv;base64,{csv_bytes}"
        report["cleaned_file_name"] = f"cleaned_{int(time.time())}.csv"
        report["user_id"] = current_user.id

        return JSONResponse(content=report)
    except Exception as error:
        traceback.print_exc()
        raise HTTPException(500, f"Error: {str(error)}")


# ============================================
# 10. نقطة الصحة (Health Check)
# ============================================

@app.get("/")
def home():
    return {"message": "AI Data Cleaning Agent is Running", "status": "healthy"}


# ============================================
# 11. تشغيل الخادم محلياً
# ============================================
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)