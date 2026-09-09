# رفع تطبيق OQZARO لتنظيف البيانات إلى Oracle Cloud (OCI)

دليل خطوة بخطوة لنقل التطبيق من Vercel إلى Oracle Cloud Infrastructure (OCI)
على جهاز VM يعمل بنظام Ubuntu. سيتكون النظام من 3 حاويات (Docker):

| الحاوية | الوظيفة | المنفذ الداخلي |
|---------|---------|----------------|
| `oqzaro-backend` | واجهة FastAPI + الذكاء الاصطناعي | 8000 |
| `oqzaro-frontend` | تطبيق Next.js | 3000 |
| `oqzaro-nginx` | عكس الوكيل + (اختياري) HTTPS | 80/443 |

---

## 1) إنشاء جهاز VM في OCI

1. سجّل الدخول إلى **Oracle Cloud Console** → **Compute → Instances → Create instance**.
2. اختر **Image: Ubuntu 22.04 أو 24.04** (علامة **Canonical Ubuntu**).
3. اختر Shape بالذاكرة المناسبة **(ننصح: 2 GB RAM + 1-2 CPU)** — VM.Standard.E2.1.Micro (مجاني) يكفي للاختبار.
4. اختر **Availability Domain** ثم **SSH key**: ارفع `id_rsa.pub` أو أنشئ مفتاحاً جديداً.
5. اضغط **Create**.

> معرفة عنوان IP العام: من صفحة الـ Instance → `Public IP address`.

## 2) فتح المنافذ (Ingress Rules)

قبل النشر يجب فتح منافذ الويب:

1. من القائمة: **Networking → Virtual Cloud Networks (VCN)**.
2. اضغط على الـ **Security List** الخاص بالشبكة الفرعية للـ instance.
3. أضف قاعدتين **Ingress**:
   - **Source:** `0.0.0.0/0` — **IP Protocol:** TCP — **Destination Port:** `80`
   - **Source:** `0.0.0.0/0` — **IP Protocol:** TCP — **Destination Port:** `443`
4. (يُفضَّل) قاعدة إضافية للمنفذ `22` للـ SSH مقصورة على عنوان IP الخاص بك فقط.

## 3) الاتصال بالجهاز والاستعداد

من حاسوبك (أو محطة عمل Windows):

```powershell
ssh -i C:\Users\hi\.ssh\id_rsa ubuntu@<YOUR_PUBLIC_IP>
```

ثم داخل الجهاز:

```bash
sudo bash -s < /path/to/scripts/_oci_vm_setup.sh
# أو إن كنت داخل مجلد المشروع:
sudo bash scripts/_oci_vm_setup.sh
```

هذا يثبّت المتطلبات ويضيف 2GB Swap.

> ⚠️ لا تفعّل جدار الحماية حتى تتأكد من أنك ما زلت تستطيع الاستمرار في الـ SSH.

## 4) نسخ المشروع إلى الجهاز

من حاسوبك (PowerShell) اسحب مجلد المشروع كاملاً، أو استخدم Git:

```powershell
# عبر scp (ينسخ المشروع كاملاً عدا .git/ وnode_modules)
scp -r C:\Users\hi\Desktop\HOME PAGE\data-cleaning-agent ubuntu@<YOUR_PUBLIC_IP>:/tmp/oqzaro
```

ثم داخل الجهاز:

```bash
sudo mkdir -p /opt/oqzaro
sudo cp -r /tmp/oqzaro/* /opt/oqzaro/
sudo chown -R ubuntu:ubuntu /opt/oqzaro
```

> **الأفضل:** ضع الكود في مستودع GitHub، ثم سيتكفّل سكربت النشر بعمل `git clone` تلقائياً (عدّل `GITHUB_REPO` داخل السكريبت).

## 5) ضبط متغيرات البيئة

```bash
cd /opt/oqzaro
cp .env.oracle.example .env
nano .env
```

املأ القيم المطلوبة:

- **`GROQ_API_KEY`** — مفتاح GROQ (الذكاء الاصطناعي). بدونها سيعمل التطبيق بوضع احتياطي بلا ذكاء اصطناعي.
- **`SITE_DOMAIN`** — نطاقك أو IP العام.
- **`SECRET_KEY`** — سلسلة عشوائية (يتولى السكريبت توليدها تلقائياً إن تركتها `CHANGE_ME`).
- **`GROQ_DISABLED=1`** في حال أردت إيقاف AI كلياً.

> المتغير `BACKEND_API_URL` داخل `docker-compose.yml` يشير بالفعل إلى
> `http://backend:8000` (اسم الحاوية)، فلا تحتاج لتغييره.
> لتطوير محلي استخدم: `BACKEND_API_URL=http://localhost:8000`.

## 6) النشر

```bash
cd /opt/oqzaro
sudo bash scripts/_deploy_oracle.sh
```

السكريبت سيقوم تلقائياً بـ:
1. تثبيت Docker و Docker Compose.
2. فتح جدار الحماية (22/80/443).
3. سحب الكود وبناء الحاويات ورفعها.
4. انتظار فحص الصحة والطباعة النهائية.

**النتيجة:**
```
Frontend:  http://<YOUR_PUBLIC_IP>
Backend:   http://<YOUR_PUBLIC_IP>:8000/docs
Health:    http://<YOUR_PUBLIC_IP>/health
```

## 7) (اختياري) HTTPS بشهادة Let's Encrypt

أسلوب سريع باستخدام Certbot مع nginx:

```bash
cd /opt/oqzaro
apt-get install -y certbot
# أوقف nginx مؤقتاً
docker compose stop nginx
# أصدِر الشهادة
certbot certonly --standalone -d yourdomain.com
# انقلها إلى مجلد الشهادات
mkdir -p certs
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem certs/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem certs/
# أعد تشغيل nginx بعد إضافة كتلة 443 في nginx/nginx.conf
docker compose start nginx
```

> يتطلب هذا نطاقاً (domain) موصولاً بعنوان IP، وليس مجرد IP عاري.

## 8) الصيانة والتحديث

```bash
# السجلات
docker compose -f /opt/oqzaro/docker-compose.yml logs -f

# إعادة البناء بعد تعديل الكود
cd /opt/oqzaro && sudo docker compose up -d --build

# إيقاف
cd /opt/oqzaro && sudo docker compose down
```

## 9) ملاحظات مهمة

- **البيانات (SQLite + الملفات المرفوعة)** محفوظة في Volumes (`backend_data` و `backend_uploads`) وتبقى حتى بعد إيقاف الحاويات لكنها تُمحى لو نفّذت `down --volumes`.
- **الحدود**: الافتراضي `MAX_ROWS=1,000,000` و `MAX_FILE_SIZE_MB=100` — عدّلها في `.env` حسب قدرة جهازك.
- **الحماية**: لا تفتح المنفذ `8000` مباشرة للعموم إلا عند الحاجة؛ `nginx` يتكفّل بالتوجيه الآمن.

---

## استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| الصفحة لا تُفتح | تأكد من **Ingress Rule** للمنفذ 80 في OCI |
| خطأ 502 | تأكد أن nginx يصل للحاويات: `docker compose ps` |
| التطبيق يعمل لكن بدون AI | تحقق من `GROQ_API_KEY` في `.env` وأعد البناء |
| لا يمكن حجز المنفذ | تأكد أن `ufw` يسمح بالمنفذ 80: `ufw status` |
