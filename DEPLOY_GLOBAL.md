# 🌍 Global Deployment Guide (HTTPS + Domain)

This guide shows how to expose the backend to the public internet so students anywhere can use the extensions.

---

## 0) Quick smoke test (no infra changes)

- Ngrok
  - Download ngrok.exe and login
  - PowerShell: `ngrok.exe http 5001`
  - Use the HTTPS URL (e.g., https://xxx.ngrok-free.app) in extension settings (server URL)
- Cloudflare Tunnel (stable, free)
  - `cloudflared tunnel --url http://localhost:5001`
  - Use the issued HTTPS URL in extension settings

If this works, proceed to proper production.

---

## 1) Provision a server + domain + TLS

- Choose a VPS (Hetzner/AWS Lightsail/Azure/GCP). Ubuntu 22.04 recommended
- Point a subdomain (A record): `api.yourdomain.com -> SERVER_IP`
- Install Nginx and Certbot

---

## 2) Backend service (Gunicorn) + Nginx reverse proxy

- Copy repository to the server (e.g., /opt/bbb-emotion)
- Create a Python venv, install `requirements.txt`
- Create a systemd service:

```
# /etc/systemd/system/bbb-emotion.service
[Unit]
Description=BBB Emotion Backend
After=network.target

[Service]
WorkingDirectory=/opt/bbb-emotion
ExecStart=/opt/bbb-emotion/venv/bin/gunicorn -w 2 -k gthread -t 120 -b 127.0.0.1:5001 python_server_central:app
EnvironmentFile=/opt/bbb-emotion/.env
Restart=always
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

- Nginx site (reverse proxy 443 -> 127.0.0.1:5001):

```
server {
  listen 80;
  server_name api.yourdomain.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name api.yourdomain.com;

  ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:5001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

- Enable and start services:
  - `sudo systemctl daemon-reload`
  - `sudo systemctl enable --now bbb-emotion`
  - `sudo certbot --nginx -d api.yourdomain.com`

---

## 3) Configure environment (.env)

Use `.env.example` as a reference. Minimum:

```
HOST=0.0.0.0
PORT=5001
DEBUG=false
DISABLE_SSL=1
MODEL_PATH=./Duygu_Tanima.h5
MAX_STUDENTS=200
RATE_LIMIT=60
SESSION_TIMEOUT=3600
CORS_ORIGINS=https://api.yourdomain.com,https://meet.google.com,https://*.zoom.us,https://*.bigbluebutton.org,chrome-extension://*
API_KEY=<set>
TEACHER_API_KEY=<set>
```

Note: In production, terminate TLS at Nginx/Cloudflare and run Flask/Gunicorn behind it over HTTP (so `DISABLE_SSL=1` is correct in this setup).

---

## 4) Extension configuration (global)

- In both extensions, set server URL to `https://api.yourdomain.com`
- Ensure manifest host_permissions include your domain. Current manifests allow all https by default, so no changes needed after our update
- If you later restrict, add `https://api.yourdomain.com/*` explicitly

---

## 5) Security hardening

- Restrict CORS to your exact domain and your extension IDs (chrome-extension://<id>)
- Use long random API keys
- Keep only 443 open in firewall
- Monitor 429 rate-limits and adjust analysis interval if needed

---

## 6) Common issues

- CORS 403: Your domain not in CORS_ORIGINS; update .env and restart
- Mixed content: Always use https in extensions
- 429 errors: Lower analysis frequency or increase RATE_LIMIT carefully
- Memory usage high: Each Gunicorn worker loads the model; size memory accordingly

---

Happy teaching! 🎓

---
---

# 🌍 Global Yayına Alma Rehberi (Türkçe)

Bu rehber, backend sunucunuzu internete açarak farklı yerlerdeki öğrencilerin eklentiyi kullanmasını sağlamayı anlatır.

---

## 0) Hızlı Test (Altyapı değişikliği olmadan)

- **Ngrok**
  - ngrok.exe indirin ve giriş yapın
  - PowerShell: `ngrok.exe http 5001`
  - Size verilen HTTPS URL'sini (örn. https://xxx.ngrok-free.app) eklenti ayarlarına (server URL) girin.
- **Cloudflare Tunnel** (kararlı, ücretsiz)
  - `cloudflared tunnel --url http://localhost:5001`
  - Size verilen HTTPS URL'sini eklenti ayarlarına girin.

Eğer bu adım çalışırsa, gerçek sunucu kurulumuna geçebilirsiniz.

---

## 1) Sunucu + Domain + TLS Hazırlığı

- Bir VPS (Sanal Sunucu) kiralayın (Hetzner, AWS, Azure, vb.). Ubuntu 22.04 önerilir.
- Bir subdomain (alt alan adı) yönlendirin (A kaydı): `api.domainadresiniz.com -> SUNUCU_IP_ADRESI`
- Nginx ve Certbot kurulumlarını yapın.

---

## 2) Backend Servisi (Gunicorn) + Nginx Ters Proxy

- Repoyu sunucuya kopyalayın (örn. /opt/bbb-emotion)
- Python sanal ortamı (venv) oluşturun ve `requirements.txt` dosyasını kurun.
- Bir systemd servis dosyası oluşturun:

```
# /etc/systemd/system/bbb-emotion.service
[Unit]
Description=BBB Emotion Backend
After=network.target

[Service]
WorkingDirectory=/opt/bbb-emotion
ExecStart=/opt/bbb-emotion/venv/bin/gunicorn -w 2 -k gthread -t 120 -b 127.0.0.1:5001 python_server_central:app
EnvironmentFile=/opt/bbb-emotion/.env
Restart=always
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

- Nginx site ayarı (443 -> 127.0.0.1:5001 yönlendirmesi - Ters Proxy):

```
server {
  listen 80;
  server_name api.domainadresiniz.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name api.domainadresiniz.com;

  ssl_certificate /etc/letsencrypt/live/api.domainadresiniz.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.domainadresiniz.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:5001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

- Servisleri başlatın:
  - `sudo systemctl daemon-reload`
  - `sudo systemctl enable --now bbb-emotion`
  - `sudo certbot --nginx -d api.domainadresiniz.com`

---

## 3) Ortam Değişkenleri (.env) Ayarı

 Referans olarak `.env.example` dosyasını kullanın. Minimum ayarlar:

```
HOST=0.0.0.0
PORT=5001
DEBUG=false
DISABLE_SSL=1
MODEL_PATH=./Duygu_Tanima.h5
MAX_STUDENTS=200
RATE_LIMIT=60
SESSION_TIMEOUT=3600
CORS_ORIGINS=https://api.domainadresiniz.com,https://meet.google.com,https://*.zoom.us,https://*.bigbluebutton.org,chrome-extension://*
API_KEY=<buraya_yazin>
TEACHER_API_KEY=<buraya_yazin>
```

Not: Prodüksiyon ortamında, TLS (SSL) sonlandırmasını Nginx veya Cloudflare yaptığı için Flask uygulamasını HTTP olarak çalıştırmak (`DISABLE_SSL=1`) doğru yöntemdir.

---

## 4) Eklenti Yapılandırması (Global)

- Her iki eklentide de (Öğrenci/Öğretmen), sunucu URL'sini `https://api.domainadresiniz.com` olarak ayarlayın.
- Manifest `host_permissions` ayarlarının domaininizi kapsadığından emin olun (Mevcut ayarlar tüm https adreslerine izin verir, ek ayar gerekmez).

---

## 5) Güvenlik Sıkılaştırma

- CORS ayarlarını sadece kendi domaininiz ve eklenti ID'lerinizle sınırlayın.
- Uzun ve rastgele API anahtarları kullanın.
- Güvenlik duvarında (Firewall) sadece 443 portunu açık tutun.
- 429 rate-limit hatalarını izleyin, gerekirse analiz sıklığını düşürün.

---

## 6) Sık Karşılaşılan Sorunlar

- **CORS 403:** Domaininiz `CORS_ORIGINS` içinde tanımlı değil; .env dosyasını güncelleyip servisi yeniden başlatın.
- **Mixed Content (Karışık İçerik):** Eklentilerde her zaman `HTTPS` kullanın.
- **429 Hataları:** Analiz sıklığını düşürün veya `RATE_LIMIT` değerini artırın.
- **Yüksek Bellek (RAM) Kullanımı:** Her Gunicorn işçisi (worker) modeli belleğe yükler; sunucu RAM'ini buna göre seçin.

---

İyi dersler! 🎓
