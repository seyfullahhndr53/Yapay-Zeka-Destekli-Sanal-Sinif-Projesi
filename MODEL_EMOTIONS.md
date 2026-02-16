# 🤖 Model Duygu Tanıma Sistemi

## 📚 Eğitilmiş Duygular

Sistemimiz **6 duygu kategorisi** ile eğitilmiştir. Sadece bu duygular tanınır:

| #   | Duygu                          | İngilizce    | Emoji | Renk            | Açıklama                 |
| --- | ------------------------------ | ------------ | ----- | --------------- | ------------------------ |
| 1   | **Kafası Karışık**             | `confused`   | 🤔    | 🟠 Turuncu      | Öğrenci konuyu anlamıyor |
| 2   | **Odaklı/İlgili**              | `engaged`    | 🎯    | 🟢 Yeşil        | Öğrenci derse konsantre  |
| 3   | **Zorlanıyor/Hayal Kırıklığı** | `frustrated` | 😤    | 🔴 Kırmızı      | Öğrenci zorluk yaşıyor   |
| 4   | **Mutlu**                      | `happy`      | 😊    | 🟡 Altın Sarısı | Öğrenci memnun           |
| 5   | **Nötr**                       | `neutral`    | 😐    | ⚪ Gri          | Öğrenci normal durumda   |
| 6   | **Uykulu**                     | `sleepy`     | 😴    | ⚫ Koyu Gri     | Öğrenci yorgun/uykulu    |

---

## 🎯 Manuel Feedback Butonları

Öğrenciler bu 3 butona tıklayarak manuel geri bildirim verebilir:

| Buton             | Duygu        | Emoji | Eşleşen Model Duygusu |
| ----------------- | ------------ | ----- | --------------------- |
| **Kafam Karıştı** | `confused`   | 🤔    | ✅ `confused`         |
| **Zorlanıyorum**  | `frustrated` | 😤    | ✅ `frustrated`       |
| **Uykum Geldi**   | `sleepy`     | 😴    | ✅ `sleepy`           |

> Not: Uykululuk durumu hem otomatik model tarafından hem de öğrenci manuel bildirimiyle takip edilebilir.

---

## 🚫 Desteklenmeyen Duygular

Bu model **sadece eğitim ortamında geçerli olan** akademik ve davranışsal duygulara odaklanmıştır. Evrensel duygu modellerinde (Ekman vb.) bulunan ancak bu projede kullanılmayan duygular:

- ❌ `sad` (üzgün)
- ❌ `angry` (kızgın)
- ❌ `fear` / `fearful` (korkmuş)
- ❌ `surprise` / `surprised` (şaşırmış)
- ❌ `disgust` / `disgusted` (tiksinti)

---

## 📊 Duygu Kategorileri

### 🟢 Pozitif Duygular

- **engaged** (🎯) - En iyi durum, öğrenci dersi dinliyor
- **happy** (😊) - Öğrenci mutlu ve rahat

### 🔴 Negatif Duygular (Alert Gerektiren)

- **confused** (🤔) - Öğretmen konuyu tekrar anlatmalı
- **frustrated** (😤) - Öğrenci zorlanıyor, yardım lazım
- **sleepy** (😴) - Mola verilmeli

### ⚪ Nötr Duygular

- **neutral** (😐) - Normal durum, aksiyon gerekmez

---

## 🎨 UI Renk Kodları

```javascript
const emotionColors = {
  confused: "#E67E22", // Turuncu
  engaged: "#2ECC71", // Yeşil
  frustrated: "#E74C3C", // Kırmızı
  happy: "#F39C12", // Altın Sarısı
  neutral: "#BDC3C7", // Gri
  sleepy: "#95A5A6", // Koyu Gri
};
```

---

## 🔧 Teknik Detaylar

### Model Eğitim Dosyaları

```
Confused.csv      → confused duygusu
Engaged.csv       → engaged duygusu
Frustrated.csv    → frustrated duygusu
Happy.csv         → happy duygusu
Neutral.csv       → neutral duygusu
Sleepy.csv        → sleepy duygusu
```

### Backend Endpoint'leri

- **POST** `/analyze` - Otomatik duygu tespit (model çıktısı)
- **POST** `/manual-feedback` - Manuel geri bildirim (öğrenci butonları)

### Frontend Mapping

- **teacher-extension/popup.js**
  - `getEmotionColor()` - Renk eşleştirme
  - `getEmotionEmoji()` - Emoji eşleştirme
  - `updateAlerts()` - Negatif duygu filtreleme

---

## 📋 Export Bilgisi

Varsayılan export formatı JSON’dur (öğretmen popup ve kontrol paneli). CSV export opsiyoneldir.

---

## 🎯 Kullanım Senaryoları

### Senaryo 1: Öğrenci Kafası Karışık (Model Tespit)

```
1. Öğrenci video açık, yüzü confused ifadesi gösteriyor
2. Model %95 güvenle "confused" tespit eder
3. Öğretmen dashboard'ında "🤔 confused" görünür
4. Alert listesine eklenir (negatif duygu)
5. Öğretmen konuyu tekrar anlatır
```

### Senaryo 2: Öğrenci Manuel Buton (Sıkıldım)

```
1. Öğrenci "😤 Sıkıldım / Zorlanıyorum" butonuna tıklar
2. Backend'e "frustrated" feedback'i gönderilir (source: manual)
3. Öğretmen dashboard'ında GÖRÜNMEZ (sessiz kayıt)
4. Ders sonunda JSON export'ta görünür
5. Öğretmen bir sonraki dersi daha eğlenceli planlar
```

---

## 📝 Notlar

**Son Güncelleme:** 16 Şubat 2026

Bu projede kullanılan yaklaşım:

- ✅ Sistem 6 duygu kategorisine odaklanır (confused/engaged/frustrated/happy/neutral/sleepy)
- ✅ Manuel butonlar bu 6 duygu ile birebir hizalıdır (confused/frustrated/sleepy)
- ✅ Öğretmen canlı paneli manuel geri bildirimleri göstermez; manuel kayıtlar export'ta görünür
- ✅ UI emoji/renk eşlemesi bu dokümanda tanımlıdır

---

## 📞 Destek

Yeni duygu kategorisi eklemek için:

1. Model eğitimi gerekir (yeni CSV dosyası)
2. Backend `/analyze` pipeline + mapping güncellenir
3. Frontend emoji/renk mapping'i eklenir
4. Bu doküman güncellenir

**Önemli:** Modelde olmayan duygular sisteme eklenemez!
