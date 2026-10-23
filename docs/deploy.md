# استقرار روی سرور مجازی

این راهنما «درون» رو روی یک سرور لینوکسی با Docker بالا میاره: PostgreSQL، API، و Caddy که اپ رو با HTTPS خودکار سرو می‌کنه.

## پیش از شروع

- **جای سرور.** Claude API در ایران پشتیبانی نمی‌شه و Docker Hub هم از IPهای ایران در دسترس نیست. پس سرور باید بیرون از ایران باشه (مثلاً آلمان، هلند یا فنلاند). کاربرها از ایران بدون مشکل به اپ وصل می‌شن.
- **منابع.** یک سرور با ۲ گیگ رم و ۱ هسته کافیه (Ubuntu 24.04 پیشنهاد می‌شه).
- **دامنه.** یک رکورد A که به IP سرور اشاره کنه، مثلاً `daroon.example.com`.
- **ایمیل.** یک سرویس SMTP برای فرستادن کد ورود، مثل Mailgun، Postmark، Amazon SES یا SMTP خود میزبان ایمیلت.
- **Google (اختیاری).** در Google Cloud Console یک OAuth Client از نوع «Web application» بساز و `https://DOMAIN` رو به Authorized JavaScript origins اضافه کن. ورود با Google برای کاربرهای داخل ایران ممکنه بدون VPN کار نکنه؛ ورود با ایمیل همیشه هست.
- **Claude (اختیاری).** یک کلید از console.anthropic.com برای داستان‌های هفته.

## قدم‌ها

```bash
# ۱. Docker
curl -fsSL https://get.docker.com | sh

# ۲. کد
sudo mkdir -p /opt/daroon && sudo chown $USER /opt/daroon
git clone https://github.com/MJAlaeddini/daroon.git /opt/daroon
cd /opt/daroon

# ۳. تنظیمات
cp deploy/.env.example deploy/.env
nano deploy/.env        # DOMAIN، ACME_EMAIL، رمزها، SMTP_URL و بقیه
#   رمزها رو این‌طوری بساز:  openssl rand -base64 48

# ۴. اجرا
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build

# ۵. بررسی
docker compose -f deploy/docker-compose.yml --env-file deploy/.env ps
curl https://DOMAIN/api/health      # باید {"ok":true} برگردونه
```

مایگریشن‌های دیتابیس موقع بالا اومدن API خودکار اجرا می‌شن. گواهی HTTPS رو Caddy خودش از Let's Encrypt می‌گیره؛ پورت‌های ۸۰ و ۴۴۳ باید باز باشن.

## به‌روزرسانی

```bash
cd /opt/daroon
git pull
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

کاربرها پیام «نسخه‌ی تازه‌ی درون آماده‌ست» رو می‌بینن و هر وقت خواستن به‌روز می‌کنن.

## پشتیبان‌گیری

```bash
sudo crontab -e
# این خط رو اضافه کن: هر شب ساعت ۳:۱۵، چهارده نسخه‌ی آخر نگه داشته می‌شه
15 3 * * * /opt/daroon/deploy/backup.sh >> /var/log/daroon-backup.log 2>&1
```

برگردوندن یک نسخه:

```bash
gunzip -c /var/backups/daroon/daroon-YYYYMMDD-HHMM.sql.gz | \
  docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec -T db psql -U daroon daroon
```

بهتره پوشه‌ی پشتیبان‌ها رو هم جای دیگه‌ای کپی کنی (مثلاً با `rclone` به یک فضای ابری).

## لاگ‌ها

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env logs -f api
```
