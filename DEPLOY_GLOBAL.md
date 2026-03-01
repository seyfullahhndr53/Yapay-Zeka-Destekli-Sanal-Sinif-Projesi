# 🌍 DEPLOYMENT (GLOBAL KULLANIM) — Cloudflare Tunnel


## TR — Cloudflare Tunnel (hızlı URL, HTTPS)

Bu tek sayfalık rehber, backend'i global erişime açmak için Cloudflare Tunnel kullanımını anlatır. Senaryonuz: backend + tunnel kendi bilgisayarınızda.

### Gerekenler

- Backend'in bilgisayarda `http://127.0.0.1:5001` üzerinde çalışması
- `cloudflared` kurulu olması

### Cloudflare (cloudflared) Kurulumu

Windows için önerilen kurulum:

```powershell
winget install Cloudflare.cloudflared
```

Kurulumdan sonra doğrula:

```powershell
cloudflared --version
```

> Eğer `winget` yoksa, Cloudflare'ın resmi `cloudflared` kurulum paketini indirip kurabilirsiniz.

### Adımlar

1) Backend'i başlat:

```powershell
python python_server_central.py
```

2) Cloudflare Tunnel çalıştır (terminal bir HTTPS URL verir):

```powershell
cloudflared tunnel --url http://127.0.0.1:5001
```

3) Terminalde çıkan HTTPS URL'yi (genelde `trycloudflare.com`) eklenti ayarındaki Backend URL alanına yapıştır. Sonra "Bağlantıyı Test Et" deyin; başarılıysa sistem hazırdır.

### Notlar

- Bilgisayar uykuya geçerse / terminal kapanırsa / internet giderse erişim kesilir.
- Tunnel yeniden başlarsa URL değişebilir.

