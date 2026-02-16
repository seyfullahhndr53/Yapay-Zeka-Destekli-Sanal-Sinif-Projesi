# Multi-Platform Emotion Extension (Student + Teacher) 🎓

Google Meet / Zoom / BigBlueButton (BBB) üzerinde öğrencilerin duygu durumlarını **sunucu tarafında (TensorFlow/Keras)** analiz eden ve öğretmen için canlı dashboard sağlayan Chrome uzantıları + Python backend.

---

## 📚 Dokümanlar

Bu repoda mevcut olan dokümanlar:

- [MODEL_EMOTIONS.md](MODEL_EMOTIONS.md) (modelin tanıdığı 6 duygu + manuel buton eşleşmesi)
- [MANUEL_FEEDBACK_DOKUMAN.md](MANUEL_FEEDBACK_DOKUMAN.md) (manuel butonlar ve export mantığı)
- [MANUEL_FEEDBACK_TEST.md](MANUEL_FEEDBACK_TEST.md) (manuel feedback test adımları)
- [TEMEL_OZELLIKLER.md](TEMEL_OZELLIKLER.md) (sistem özellikleri ve detaylar)
- [DEPLOY_GLOBAL.md](DEPLOY_GLOBAL.md) (global deployment / HTTPS)

## ✨ Özellikler

### 🎯 Öğrenci

- **Otomatik Duygu Tanıma**: Öğrenci kamerasından alınan görüntü backend'e gönderilir; TensorFlow/Keras modeli ile sunucuda analiz edilir

- **Manuel Geri Bildirim**: 3 hızlı buton (🤔 Kafam Karıştı, 😤 Sıkıldım/Zorlanıyorum, 😴 Uykum Geldi)

- **Gizlilik Odaklı**: Manuel geri bildirimler öğretmenin canlı listesinde/uyarılarında görünmez; sadece export (JSON) içinde yer alır

- **Hafif ve Performanslı**: Minimal kaynak kullanımı

### 👨‍🏫 Öğretmen

- **Gerçek Zamanlı Dashboard**: Sınıftaki öğrencilerin duygu durumlarını canlı izleme

- **JSON Export (varsayılan)**: Zenginleştirilmiş JSON formatıyla veri dışa aktarma (ham kayıt `raw` alanında)

- **Manuel/Otomatik Ayırımı**: Export içindeki `raw.emotions[0].source` alanı ile ayırt edilebilir (manuel kayıtta `"manual"`; otomatik kayıtta alan olmayabilir)

- **Uyarılar**: Canlı listede negatif duygular (confused/frustrated/sleepy) ve eşik üstü confidence ile uyarı üretir

---

## 📁 Proje Yapısı

```
Eklenti/
├── student-extension/          # Öğrenci Chrome Uzantısı
│   ├── emotion.js             # Duygu analizi + Manuel feedback
│   ├── background.js          # CORS bypass + API iletişim
│   ├── popup.html/js          # Uzantı popup UI
│   └── manifest.json          # Chrome manifest V3
├── teacher-extension/          # Öğretmen Chrome Uzantısı
│   ├── popup.js               # Dashboard + Export mantığı
│   ├── background.js          # Backend proxy ve veri temizleme
│   └── manifest.json          # Chrome manifest V3
├── python_server_central.py   # Flask Backend (Port 5001)
├── requirements.txt           # Python bağımlılıkları
├── Duygu_Tanima.h5            # Keras/TensorFlow model
├── cert.pem / key.pem         # (Opsiyonel) HTTPS sertifikaları
└── run_simple.ps1             # Basit çalıştırma scripti
```

## 🚀 Kurulum (5 Adım)

### 1️⃣ Python Backend

```powershell
pip install -r requirements.txt
cp .env.example .env  # Opsiyonel: Ayarları özelleştirmek için
python python_server_central.py
```

Backend varsayılan olarak `http://127.0.0.1:5001` üzerinden erişilir (dev). Model olarak `Duygu_Tanima.h5` yüklenir (TensorFlow/Keras).

Alternatif hızlı geliştirme modu:

```powershell
./run_simple.ps1
```

### 2️⃣ Öğrenci Uzantısı

1. chrome://extensions/ açın
2. Geliştirici modunu açın
3. Paketlenmemiş → student-extension klasörünü seçin

### 3️⃣ Öğretmen Uzantısı

1. chrome://extensions/ açın
2. Paketlenmemiş → teacher-extension klasörünü seçin

### 4️⃣ İlk Yapılandırma

- Öğrenci: Ayarlar → Backend URL (http://localhost:5001)
- Öğretmen: Popup açıldığında bağlantı test edilir

### 5️⃣ Test

1. BBB/Meet dersini açın
2. Öğrenci uzantısında Analizi Başlat
3. İsim/Sınıf Kodu girin
4. Sol üstte 3 manuel buton görünür
5. Öğretmen uzantısında canlı panel çalışır (sadece otomatik tespitler)

---

## 📖 Kullanım

### 🧑‍🎓 Öğrenci

1. BBB / Google Meet / Zoom dersine katılın
2. Analizi Başlat
3. Manuel butonlar (sürükle-bırak ile taşınabilir ve konumu kalıcıdır):
   - 🤔 Kafam Karıştı
  - 😤 Zorlanıyorum (frustrated)
  - 😴 Uykum Geldi

> Not: Manuel geri bildirimler öğretmen canlı panelinde görünmez. JSON export’ta yer alır (isterseniz Excel/PowerQuery ile CSV’ye dönüştürebilirsiniz).

### 👨‍🏫 Öğretmen

1. Popup’ı açın → Aktif öğrencileri görün
2. Verileri İndir → JSON export (zenginleştirilmiş format)
3. JSON’da her kayıt şu alanları içerir: studentName, emotion, confidence(%), timestamp(ms), localTime, time(ISO), raw (ham kayıt)

JSON örneği:

```json
[
  {
    "studentName": "Ahmet",
    "emotion": "confused",
    "confidence": 95,
    "timestamp": 1736077822000,
    "localTime": "16.02.2026 14:30:22",
    "time": "2026-02-16T11:30:22.000Z",
    "raw": {
      "studentName": "Ahmet",
      "emotions": [{ "emotion": "confused", "confidence": 0.95 }],
      "timestamp": "2025-01-05T14:30:22",
      "server_time": 1736077822
    }
  }
]
```

---

## 📊 Proje Durumu

- ✅ Güvenlik: API Key ve CORS yapılandırması
- ✅ Global Ready: Production’a uygun backend/uzantılar
- ✅ Documentation: Güncel ve tutarlı
- ✅ Clean Codebase: Gereksiz dosyalar temizlendi

---

## 🔧 Gereksinimler

| Bileşen      | Gereksinim                         |
| ------------ | ---------------------------------- |
| **Python**   | 3.8+                               |
| **Tarayıcı** | Chrome/Edge (Manifest V3)          |
| **Webcam**   | Öğrenci için gerekli               |
| **Portlar**  | 5001 (HTTP)                        |
| **İnternet** | Opsiyonel (global backend kullanımı için) |

---

## 📚 DETAYLI DOKÜMANTASYON

| Dosya                                                        | İçerik                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **[MANUEL_FEEDBACK_DOKUMAN.md](MANUEL_FEEDBACK_DOKUMAN.md)** | Manuel geri bildirim sistemi kullanım kılavuzu (Kaynak ve Köken sütunları dahil) |
| **[MANUEL_FEEDBACK_TEST.md](MANUEL_FEEDBACK_TEST.md)**       | Test senaryoları ve hata ayıklama adımları                                       |
| **[TEMEL_OZELLIKLER.md](TEMEL_OZELLIKLER.md)**                 | Temel sistem özellikleri ve teknik detaylar                                       |

---

## 🐛 SORUN GİDERME

### Backend Bağlanamıyor

```powershell
# Backend çalışıyor mu kontrol et
python python_server_central.py

# Port kullanımda mı?
netstat -ano | findstr :5001
```

### Manuel Feedback Kaydedilmiyor

1. **Console aç** (F12)
2. **"Kafam Karıştı"** butonuna tıkla
3. Console'da şunları görmeli:
   ```
   [Manual Feedback] Sending confused...
   [Manual Feedback] Success: {...}
   ```
4. Backend terminal'de:
   ```
   [INFO] /manual-feedback - Received from: Ahmet
   ```

### Webcam Çalışmıyor

- Tarayıcı izni verildi mi? (`chrome://settings/content/camera`)
- Desteklenen bir sayfada mısın? (BBB / Google Meet / Zoom)
- Console'da "MediaDevices" hatası var mı?

---

## 🌍 DEPLOYMENT (GLOBAL KULLANIM)

### Seçenek 1: VPS (DigitalOcean, AWS, Azure)

```bash
# Sunucuya deploy et
scp -r * user@your-server.com:/opt/bbb-emotion
ssh user@your-server.com
cd /opt/bbb-emotion
python python_server_central.py
```

DNS ayarla: `emotion.example.com` → Server IP

### Seçenek 2: Ngrok (Hızlı Test)

```bash
ngrok http 5001
```

Ngrok URL'sini uzantı ayarlarına gir

### Seçenek 3: Railway / Render (Ücretsiz)

- GitHub'a push
- Railway.app'de "New Project" → GitHub repo bağla
- Otomatik deploy edilir

---

## 📱 TELEFONDA KULLANIM

Chrome uzantıları mobilde çalışmaz. **Alternatif çözüm**:

### PWA (Progressive Web App) Oluştur

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html>
  <head>
    <link rel="manifest" href="manifest.json" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <video id="webcam" autoplay></video>
    <script src="emotion-mobile.js"></script>
  </body>
</html>
```

Mobil tarayıcıda aç → **"Ana Ekrana Ekle"** → Uygulama gibi çalışır

---

## 📊 SİSTEM MİMARİSİ

```
┌─────────────────┐         ┌─────────────────┐
│ Öğrenci Browser │         │ Öğretmen Browser│
│  (Chrome Ext)   │         │  (Chrome Ext)   │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ HTTP POST                 │ HTTP GET
         │ /analyze                  │ /teacher-dashboard
         │ /manual-feedback          │ /teacher-settings (GET/POST)
         │                           │ /clear-data (POST)
         └───────────┬───────────────┘
                     ▼
         ┌───────────────────────┐
         │  Flask Backend        │
         │  python_server_central│
         │  Port: 5001           │
         └───────────────────────┘
                     │
         ┌───────────┴───────────┐
         │  In-Memory Storage    │
         │  - student_emotions   │
         │  - active_students    │
         │  - analysis_history   │
         └───────────────────────┘
```

---

## 📜 LİSANS

[LICENSE](LICENSE) dosyasına bakınız.

---

## 🙋‍♂️ DESTEK

- **Hata Bildirimi**: GitHub Issues
- **Soru/Öneri**: Discussions sekmesi
- **Acil Destek**: Dokümantasyondaki troubleshooting bölümünü inceleyin

---

---

Ek notlar:

- 🔒 Gizlilik: Veriler kalıcı depolanmaz (in-memory). Ders bitiminde export opsiyoneldir.
- 🛡️ Rate-limit: Öğrenci oturumu (userId+IP) başına 60/dk + 1 saniye aralık.
- 👥 Öğrenci limiti: Öğretmen panelinden ayarlanır (default 200; 10/20/30/50/200/999 seçenekleri).
- 🔘 Manuel butonlar: Sürükle-bırak ile taşınabilir, konumu kalıcıdır.

**Son Güncelleme**: 16 Şubat 2026
**Versiyon**: 1.0.0 - JSON Export & Privacy-first
