# OQZARO Data Analysis Agent

وكيل تحليل البيانات — منصة SaaS متكاملة لرفع البيانات، تنظيفها، تحليلها، وإنشاء تقارير احترافية.

## التقنيات

| الطبقة | التقنية |
|--------|---------|
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS, Framer Motion, Recharts |
| **Backend** | FastAPI, Python 3.12, Pandas, NumPy, Matplotlib, Seaborn |
| **قاعدة البيانات** | SQLite ( lokall ) + SQLAlchemy |
| **الذكاء الاصطناعي** | Groq API (Qwen) — اختياري |
| **النشر** | Docker Compose + Nginx |

## المميزات

- **تحليل البيانات** — إحصاءات وصفية، رسوم بيانية، شروحات ذكية
- **تنظيف البيانات** — إزالة التكرارات، معالجة القيم المفقودة، تحويل الأنواع
- **دمج وتحويل الملفات** — دمج عدة ملفات CSV/Excel، تحويل بين الصيغ
- **التقارير** — تقارير شاملة بقوالب PDF احترافية
- **المحادثة الذكية** — سؤال الوكيل عن نتائج التحليل (Qwen عبر Groq)
- **إدارة الملفات** — رفع سحب وإفلات، دعم CSV و Excel
- **مصادقة المستخدمين** — تسجيل دخول/خروج مع JWT
- **واجهة عربية** — تصميم بالعربية مع دعم RTL

## التشغيل المحلي

### باستخدام Docker

```bash
# نسخ ملف البيئة
cp .env.oracle.example .env

# تشغيل جميع الخدمات
docker-compose up --build

# الوصول
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# Nginx:    http://localhost:80
```

### يدوياً

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

## هيكل المشروع

```
data-cleaning-agent/
├── backend/
│   ├── main.py              # FastAPI app + جميع الـ routes
│   ├── config.py             # الإعدادات والمتغيرات البيئية
│   ├── cleaner.py            # محرك تنظيف البيانات
│   ├── analyzer.py           # محرك التحليل الإحصائي
│   ├── charting.py           # توليد الرسوم البيانية
│   ├── auth.py               # المصادقة (JWT + bcrypt)
│   ├── db.py                 # قاعدة البيانات (SQLite)
│   ├── exporter.py           # تصدير البيانات
│   ├── report.py             # توليد التقارير
│   ├── ai.py                 # التكامل مع Groq API
│   ├── validator.py          # التحقق من صحة البيانات
│   └── requirements.txt
├── frontend/
│   ├── app/                  # صفحات Next.js (App Router)
│   │   ├── dashboard/        # لوحة التحكم
│   │   ├── api/              # API routes
│   │   └── login/            # صفحات المصادقة
│   ├── components/           # مكونات React
│   ├── lib/                  # خدمات ومساعدات
│   └── package.json
├── docker-compose.yml
├── nginx/                    # إعدادات Nginx
└── scripts/                  # سكربتات مساعدة
```

## المتغيرات البيئية

| المتغير | الوصف | القيمة الافتراضية |
|---------|-------|-------------------|
| `SECRET_KEY` | مفتاح JWT | مُولّد تلقائياً |
| `GROQ_API_KEY` | مفتاح Groq API (اختياري) | — |
| `GROQ_MODEL` | نموذج Groq | `qwen/qwen3.8-27b` |
| `MAX_ROWS` | أقصى عدد صفوف | `1000000` |
| `MAX_FILE_SIZE_MB` | أقصى حجم ملف (MB) | `100` |
| `CORS_ORIGINS` | أصول CORS المسموحة | localhost |

## الترخيص

مشروع خاص — All Rights Reserved.
