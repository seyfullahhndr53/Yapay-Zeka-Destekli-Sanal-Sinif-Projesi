# 🧪 Manuel Feedback Test Script

## TEST ADIMLARI

### 1️⃣ Backend'i Başlat

```powershell
python python_server_central.py
```

Beklenen çıktı:

```
*** AI Sınıf Kontrolü - Merkezi Backend Server ***
=====================================================
🌐 Host: 0.0.0.0
🔌 Port: 5001
...
 * Running on http://127.0.0.1:5001
```

---

### 2️⃣ Extension'ı Reload Et

1. Chrome'da `chrome://extensions/` aç
2. "Student Extension" bulun
3. 🔄 "Yeniden yükle" tıkla

---

### 3️⃣ Google Meet'e Katıl ve Analizi Başlat

1. Google Meet toplantısına katıl
2. Student extension popup'ını aç
3. Adını ve toplantı kodunu gir
4. "Analizi Başlat" tıkla

---

### 4️⃣ Manuel Feedback Butonlarını Test Et

Sol üst köşede şu butonları göreceksin:

- 🤔 **Kafam Karıştı** (Turuncu)
- 😤 **Sıkıldım / Zorlanıyorum** (Kırmızı)
- 😴 **Uykum Geldi** (Kırmızı)

Her buton için:

1. Butona tıkla
2. Toast mesajı gördün mü? "Kaydedildi ✓"
3. Console açık mı? (F12)

---

### 5️⃣ Console Log Kontrolü

#### Student Extension Console'da:

```javascript
✅ Manuel feedback butonları eklendi
📤 Manuel feedback sessizce kaydediliyor: Kafam Karıştı
   Öğrenci: Ahmet Yılmaz, UserID: abc123-def456
   Emotion: confused, Label: Kafam Karıştı
📤 Gönderilen payload: {
  "studentName": "Ahmet Yılmaz",
  "userId": "abc123-def456",
  "manualFeedback": {
    "emotion": "confused",
    "label": "Kafam Karıştı",
    "timestamp": 1728134595000,
    "confidence": 1.0,
    "source": "manual"
  }
}
📥 Backend yanıtı: { success: true, message: "..." }
✅ Manuel feedback sessizce kaydedildi: Kafam Karıştı (öğretmen görmez)
```

#### Backend Terminal'de:

```python
📥 Manuel feedback alındı: {'studentName': 'Ahmet Yılmaz', ...}
   Öğrenci: Ahmet Yılmaz
   User ID: abc123-def456
   Feedback: {'emotion': 'confused', 'label': 'Kafam Karıştı', ...}
✅ Manuel feedback kaydedildi: Ahmet Yılmaz - Kafam Karıştı
   Toplam student emotions: 15
   Toplam analysis history: 15
```

---

### 6️⃣ Teacher Extension'da Export Test (JSON varsayılan)

1. Teacher extension popup'ını aç
2. "📊 Verileri İndir" tıkla
3. JSON dosyasını aç
4. Kayıtlarda `raw` alanı ve zaman damgaları (`server_time` öncelikli) var mı?

Beklenen JSON öğesi:

```json
{
  "studentName": "Ahmet Yılmaz",
  "emotion": "confused",
  "confidence": 100,
  "timestamp": 1728134595000,
  "localTime": "05.10.2025 14:23:15",
  "time": "2025-10-05T11:23:15.000Z",
  "raw": { "emotions": [{ "emotion": "confused", "source": "manual" }] }
}
```

---

## 🚨 SORUN GİDERME

### Hata 1: "Kayıt başarısız ✗"

**Olası Sebepler:**

- Backend kapalı
- Student name/user ID eksik
- CORS hatası

**Kontrol:**

```javascript
// Chrome Console'da:
chrome.storage.local.get(["studentName", "userId"], console.log);
```

**Beklenen:**

```javascript
{
  studentName: "Ahmet Yılmaz",
  userId: "abc123-def456..."
}
```

---

### Hata 2: "Bağlantı hatası ✗"

**Olası Sebepler:**

- Backend çalışmıyor
- Port 5001 kapalı
- Firewall bloğu

**Kontrol:**

```powershell
# PowerShell'de:
curl http://127.0.0.1:5001/health
```

**Beklenen:**

```json
{ "status": "OK" }
```

---

### Hata 3: Backend 400 BAD REQUEST

**Olası Sebepler:**

- Veri formatı hatalı
- manualFeedback objesi eksik

**Kontrol:**
Backend console'da:

```python
📥 Manuel feedback alındı: ...
❌ Feedback verisi eksik!  # ← Bu mesajı görüyorsan
```

**Çözüm:**
Extension'ı reload et ve tekrar dene.

---

## ✅ BAŞARILI TEST KRİTERLERİ

- [ ] Backend başlatıldı
- [ ] Extension reload edildi
- [ ] Analiz başlatıldı
- [ ] Manuel butonlar görünüyor
- [ ] Butona tıklanınca toast gösteriliyor
- [ ] Console'da ✅ mesajları var
- [ ] Backend'de kayıt logları var
- [ ] JSON export'unda manuel feedback görünüyor

---

## 🎯 BEKLENEN SONUÇ

Her butona tıkladığında:

1. **Ekranda:** "Kafam Karıştı kaydedildi ✓" toast (yeşil)
2. **Console:** ✅ log'ları
3. **Backend:** 📝 kayıt logları
4. **JSON:** Manuel feedback kaydı (`raw.emotions[0].source = "manual"`)

---

## 📊 PERFORMANS BEKLENTİLERİ

- Toast gösterim: < 100ms
- Backend yanıt: < 500ms
- JSON export: < 2 saniye

---

**Test Tarihi:** 16 Şubat 2026
**Versiyon:** 1.0.0
**Test Eden:** TÜBİTAK 2209/A Proje Grubu
