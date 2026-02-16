# 📊 Manuel Feedback Sistemi - Dokümantasyon

> Not: Sistem varsayılan olarak **JSON export** sağlar. CSV formatı istenirse JSON verisi Excel veya PowerQuery ile dönüştürülebilir.

## 🎯 Nasıl Çalışır?

### Öğrenci Tarafı

1. **Öğrenci** derse başlar (analizi başlatır)
2. Sol üst köşede 3 buton görünür (sürüklenebilir ve konumu kalıcıdır):
   - 🤔 Kafam Karıştı (confused)
   - 😤 Zorlanıyorum (frustrated)
   - 😴 Uykum Geldi (sleepy)
3. Öğrenci butona tıklar
4. **Sessizce backend'e kaydedilir** ✅
5. Öğrenciye toast: "Kaydedildi ✓"

### Öğretmen Tarafı

1. **Öğretmen popup'ı açar**
2. ❌ **MANUEL FEEDBACK'LERİ GÖRMEZ**
3. ✅ Sadece otomatik duygu analizi sonuçlarını görür (manuel geri bildirimler canlıda görünmez)
4. **"Verileri İndir"** butonuna tıklar
5. ✅ JSON export dosyasında **TÜM veriler** vardır (isterseniz Excel/PowerQuery ile CSV'ye dönüştürülebilir):
   - Otomatik tespit edilen duygular
   - Manuel feedback'ler (ayrı işaretli)

---

## 📄 Export Formatları

### Dosya Adı

```
ai-sinif-analizi-2026-02-16.json
```

### JSON İçeriği (Standart)

```json
[
  {
    "studentName": "Ahmet",
    "emotion": "confused",
    "confidence": 95,
    "timestamp": 1728134595000,
    "localTime": "16.02.2026 14:23:15",
    "time": "2026-02-16T11:23:15.000Z",
    "raw": {
      /* backend kaydı */
    }
  }
]
```

### CSV Dönüşüm Örneği

```csv
Tarih,Öğrenci,Duygu,Güven,Kaynak,Köken,Etiket,Zaman

=== ÖZET İSTATİSTİKLER ===
Toplam Kayıt: 150
Otomatik Tespit: 130
Manuel Feedback: 20

=== MANUEL FEEDBACK DAĞILIMI ===
🤔 Kafam Karıştı: 8
😑 Sıkıldım: 7
😴 Uykum Geldi: 5

=== DETAYLI VERİLER ===
"16.02.2026 14:23:15","Ahmet Yılmaz","🤔 confused","100%","📝 Manuel","student","Kafam Karıştı","1728134595000"
"16.02.2026 14:24:30","Ayşe Demir","😊 happy","87%","🤖 Otomatik","system","Happy","1728134670000"
"16.02.2026 14:25:45","Mehmet Çelik","😴 sleepy","100%","📝 Manuel","student","Uykum Geldi","1728134745000"
```

### CSV Sütun Açıklamaları

| Sütun       | Açıklama                                   | Örnek                         |
| ----------- | ------------------------------------------ | ----------------------------- |
| **Tarih**   | Feedback zamanı (Türkçe format)            | 16.02.2026 14:23:15           |
| **Öğrenci** | Öğrenci adı                                | Ahmet Yılmaz                  |
| **Duygu**   | Duygu etiketi                              | confused, sleepy, frustrated  |
| **Güven**   | Güven skoru (%)                            | 100% (manuel), 87% (otomatik) |
| **Kaynak**  | Veri kaynağı                               | 📝 Manuel veya 🤖 Otomatik    |
| **Köken**   | Verinin kökeni (opsiyonel - dönüşüm kuralı) | student/system                |
| **Etiket**  | İnsan okunabilir etiket                    | Kafam Karıştı, Uykum Geldi    |
| **Zaman**   | Unix timestamp (server_time tercih edilir) | 1728134595000                 |

---

## 🔍 Manuel Feedback'leri Nasıl Ayırt Edebilirim?

> Not: Teacher uzantısı **JSON** indirir. Aşağıdaki "Kaynak/Köken" gibi sütunlar, JSON'u Excel/PowerQuery ile CSV'ye dönüştürürken oluşturulan **opsiyonel** kolonlardır.

### Yöntem 0: JSON İçinde `source` Alanına Bak

- Manuel feedback kayıtlarında: `raw.emotions[0].source = "manual"`
- Otomatik tespit kayıtlarında: `source` alanı olmayabilir (yoksa otomatik kabul edebilirsin)

### Yöntem 1: "Kaynak" Sütununa Bak

```csv
...,"📝 Manuel",...  → Öğrenci butona bastı ✋
...,"🤖 Otomatik",... → Model otomatik tespit etti 🤖
```

### Yöntem 2: "Güven" Sütununa Bak

```csv
...,"100%","📝 Manuel",...  → Manuel feedback (çoğu zaman 100%)
...,"87%","🤖 Otomatik",... → Otomatik tespit (değişken)
```

### Yöntem 3: "Etiket" Sütununa Bak

```csv
...,"Kafam Karıştı",... → Bu 3 etiket manuel butonlara karşılık gelir
...,"Zorlanıyorum",...
...,"Uykum Geldi",...
```

---

## 📊 Excel'de Analiz Örnekleri

### 1. Manuel Feedback Sayısını Bul

```excel
=COUNTIF(E:E,"Manuel")
```

### 2. En Çok Hangi Manuel Feedback Verildi?

```excel
=COUNTIF(F:F,"Kafam Karıştı")
=COUNTIF(F:F,"Sıkıldım")
=COUNTIF(F:F,"Uykum Geldi")
```

### 3. Hangi Öğrenci En Çok Manuel Feedback Verdi?

```excel
Pivot Table:
Satırlar: Öğrenci
Değerler: COUNT(Kaynak) WHERE Kaynak="Manuel"
```

### 4. Hangi Saatte En Çok "Uykum Geldi" Bildirimi Var?

```excel
Tarih sütununu saat bazında grupla
COUNTIFS(F:F,"Uykum Geldi", A:A,"*14:*")
```

---

## 🎯 Kullanım Senaryoları

### Senaryo 1: Öğrenci Kafasının Karışık Olduğunu Bildiriyor

```
[Öğrenci]
1. Dersi dinliyor
2. Bir konuyu anlamıyor
3. 🤔 butonuna tıklıyor
4. "Kaydedildi ✓" toast görüyor

[Backend]
- Sessizce kaydediliyor
- student_emotions listesine ekleniyor
- source: "manual" olarak işaretleniyor

[Öğretmen]
- Popup'ta BİR ŞEY GÖRÜNMÜYOR ❌
- Ders sonunda "Verileri İndir" tıklıyor
- JSON export'ta görüyor (isterse CSV'ye dönüştürür): "Ahmet - Kafam Karıştı - 14:23"
- Hangi konuda zorlandığını anlıyor
```

### Senaryo 2: Toplu Analiz

```
[Ders Sonu]
Öğretmen JSON export'u indiriyor (isterse CSV'ye dönüştürür):
- 25 öğrenci vardı
- 18'i en az 1 manuel feedback vermiş
- 12 tane "Kafam Karıştı" bildirimi var
- Hepsi 14:20-14:30 arasında (10 dakikalık dilim)

[Sonuç]
→ O zaman aralığında anlatılan konu tekrar edilmeli
→ Öğrenciler o kısımda zorlandı
```

### Senaryo 3: Öğrenci Takibi

```
[Haftalık Analiz]
JSON export dosyalarını birleştir (isterse CSV'ye dönüştür):
- Ali: 8 kez "Uykum Geldi" bildirdi
- Veli: 12 kez "Kafam Karıştı" bildirdi
- Ayşe: Hiç manuel feedback vermedi

[Sonuç]
→ Ali dersleri yorgun geliyor, uyku düzenine bak
→ Veli konuları anlamakta zorlanıyor, ek destek ver
→ Ayşe ya anlıyor ya da çekinik
```

---

## 🔒 Gizlilik ve Etik

### ✅ İyi Yanlar

- Öğrenci kendini ifade edebiliyor
- Öğretmen anlık baskı altında kalmıyor
- Veriler sonradan analiz edilebiliyor
- Öğrenci kimliği export (JSON) içinde var (şeffaf)

### ⚠️ Dikkat Edilmesi Gerekenler

- Manuel feedback'ler **silme hakkı** olmalı (GDPR)
- Öğrenciler sistemi **yanlış kullanabilir** (sürekli tıklama)
- Veriler **güvenli saklanmalı** (şifreleme)
- Öğrenciler **bilgilendirilmeli** (veri toplama hakkında)

---

## 🛠️ Troubleshooting

### Problem 1: Manuel butonlar görünmüyor

**Çözüm:**

```javascript
// Console'da kontrol et:
document.getElementById("manual-feedback-container");
// null dönüyorsa → Extension yeniden yükle
```

### Problem 2: Butona bastım ama export'ta (JSON) yok

**Çözüm:**

1. Backend çalışıyor mu kontrol et
2. Network tab'da `/manual-feedback` isteğine bak
3. Response 200 OK mi?
4. `student_emotions` listesini kontrol et:

```python
print(len(student_emotions))  # Backend console
```

### Problem 3: JSON'da "source" bilgisi yok

**Çözüm:**

- Manuel feedback kayıtlarında `raw.emotions[0].source` alanı `"manual"` olmalıdır
- Otomatik kayıtlarda `source` alanı olmayabilir (source yoksa otomatik kabul edebilirsiniz)
- Eğer export içinde hiç `raw` alanı yoksa teacher export sırasında backend verisi alınamamış olabilir; önce backend bağlantısını doğrula
- Cache temizle ve uzantıları yeniden yükle

---

## 📈 Backend Veri Yapısı

### Manuel Feedback Objesi

```python
{
    'studentName': 'Ahmet Yılmaz',
    'userId': 'abc123-def456',
    'timestamp': 1728134595000,
    'emotions': [
        {
            'emotion': 'confused',
            'confidence': 1.0,
            'source': 'manual',
            'origin': 'student',
            'label': 'Kafam Karıştı'
        }
    ]
}
```

### Otomatik Tespit Objesi (Karşılaştırma)

```python
{
    'studentName': 'Ayşe Demir',
    'userId': 'ghi789-jkl012',
    'timestamp': 1728134670000,
    'emotions': [
        {
            'emotion': 'happy',
            'confidence': 0.87,
            'origin': 'system',
            'label': 'Mutlu'
        }
    ]
}
```

---

## ✅ Test Checklist

- [x] Öğrenci butona bastığında backend'e kayıt atılıyor
- [x] Öğretmen popup'ında manuel feedback görünmüyor
- [x] JSON export'unda manuel feedback'ler var
- [x] JSON içinde `raw.emotions[0].source = "manual"` bilgisi var
- [x] Özet istatistikler doğru hesaplanıyor
- [x] Toast bildirimi gösteriliyor
- [x] Backend log'larında kayıt görünüyor

---

**Son Güncelleme:** 16 Şubat 2026  
**Versiyon:** 1.0.0 (Final)  
**Durum:** ✅ Production Ready (Revize)
