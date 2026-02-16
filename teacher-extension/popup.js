document.addEventListener("DOMContentLoaded", function () {
  const teacherInfo = document.getElementById("teacherInfo");
  const studentCount = document.getElementById("studentCount");
  const alertCount = document.getElementById("alertCount");
  const studentsList = document.getElementById("studentsList");
  const alertSection = document.getElementById("alertSection");
  const alertList = document.getElementById("alertList");
  const exportBtn = document.getElementById("exportBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const clearBtn = document.getElementById("clearBtn");
  const refreshBtn = document.getElementById("refreshBtn");

  // Normalize emotion labels from backend (TR/EN) into canonical EN keys
  function canonicalizeEmotion(emotion) {
    const raw = String(emotion || "").trim();
    const lower = raw.toLowerCase();
    // Direct EN keys
    const en = [
      "confused",
      "engaged",
      "frustrated",
      "happy",
      "neutral",
      "sleepy",
    ];
    if (en.includes(lower)) return lower;
    // Turkish → EN mapping
    const trMap = {
      "kafası karışmış": "confused",
      "kafasi karismis": "confused",
      "kafasi karışmış": "confused",
      odaklanmış: "engaged",
      odaklanmis: "engaged",
      yılmış: "frustrated",
      yilmis: "frustrated",
      sıkılmış: "frustrated",
      sikilmis: "frustrated",
      zorlanıyor: "frustrated",
      zorlaniyor: "frustrated",
      mutlu: "happy",
      doğal: "neutral",
      dogal: "neutral",
      nötr: "neutral",
      notr: "neutral",
      uykulu: "sleepy",
    };
    if (trMap[lower]) return trMap[lower];
    // Heuristics
    if (lower.includes("kafa") || lower.includes("karış")) return "confused";
    if (lower.includes("odak")) return "engaged";
    if (
      lower.includes("yıl") ||
      lower.includes("zorlan") ||
      lower.includes("sık")
    )
      return "frustrated";
    if (lower.includes("mutlu")) return "happy";
    if (
      lower.includes("nötr") ||
      lower.includes("notr") ||
      lower.includes("doğal") ||
      lower.includes("dogal")
    )
      return "neutral";
    if (lower.includes("uyku")) return "sleepy";
    return lower || "unknown";
  }

  // Yardımcı: En güncel otomatik (manual olmayan) kaydı öğrenci bazında seç
  function getLatestNonManualByStudent(items) {
    const map = {};
    for (const item of items || []) {
      const e = (item.emotions && item.emotions[0]) || null;
      if (!e || e.source === "manual") continue; // manueli canlıda gösterme
      const key = item.studentName;
      const t = item.server_time || new Date(item.timestamp).getTime() || 0;
      if (!map[key]) {
        map[key] = item;
      } else {
        const pt =
          map[key].server_time || new Date(map[key].timestamp).getTime() || 0;
        if (t > pt) map[key] = item;
      }
    }
    return map;
  }

  // Yardımcı: Ekranda Türkçe etiket göster (CSV/export değişmedi)
  function translateEmotionTR(emotion) {
    const k = canonicalizeEmotion(emotion);
    const tr = {
      confused: "Kafası Karışık",
      engaged: "Odaklı/İlgili",
      frustrated: "Sıkılmış/Zorlanıyor",
      happy: "Mutlu",
      neutral: "Nötr",
      sleepy: "Uykulu",
    };
    return tr[k] || emotion || "Belirsiz";
  }

  function loadTeacherInfo() {
    try {
      if (!chrome || !chrome.storage) {
        teacherInfo.innerHTML =
          '<div class="loading">⚠️ Chrome storage erişimi yok</div>';
        return;
      }

      chrome.storage.local.get(["userId", "userName"], function (result) {
        if (chrome.runtime.lastError) {
          console.error("Storage error:", chrome.runtime.lastError);
          teacherInfo.innerHTML =
            '<div class="loading">⚠️ Storage hatası</div>';
          return;
        }

        if (result.userId && result.userName) {
          teacherInfo.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-weight: 600; font-size: 14px;">${
                result.userName
              }</div>
              <div style="font-size: 11px; opacity: 0.8;">Öğretmen ID: ${result.userId.substring(
                0,
                12
              )}...</div>
            </div>
            <div style="background: rgba(46, 204, 113, 0.2); color: #2ecc71; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
              🟢 Aktif
            </div>
          </div>
        `;
        } else {
          teacherInfo.innerHTML = `
            <div class="loading">⚠️ Öğretmen bilgisi bulunamadı</div>
          `;
        }
      });
    } catch (error) {
      console.error("❌ loadTeacherInfo hatası:", error);
      teacherInfo.innerHTML =
        '<div class="loading">⚠️ Extension context hatası</div>';
    }
  }

  async function updateStudentData() {
    try {
      if (!chrome || !chrome.storage) {
        console.warn("⚠️ Chrome storage erişimi yok");
        return;
      }
      // Prefer backend dashboard via background proxy
      const syncVals = await chrome.storage.sync.get([
        "serverUrl",
        "backendUrl",
        "teacherApiKey",
        "emotionThreshold",
      ]);
      const baseUrl = (
        syncVals.serverUrl ||
        syncVals.backendUrl ||
        "http://127.0.0.1:5001"
      ).replace(/\/$/, "");
      const apiKey = syncVals.teacherApiKey || "";
      let threshold =
        typeof syncVals.emotionThreshold === "number"
          ? syncVals.emotionThreshold
          : 0.7;

      const dashboard = await new Promise((resolve) =>
        chrome.runtime.sendMessage(
          { action: "GET_DASHBOARD", baseUrl, apiKey },
          (res) => resolve(res)
        )
      );

      let activeStudents = {};
      if (
        dashboard &&
        dashboard.success &&
        dashboard.data &&
        dashboard.data.success
      ) {
        const recent = dashboard.data.recent_emotions || [];
        // Öğrenci bazında en güncel otomatik kaydı seç
        activeStudents = getLatestNonManualByStudent(recent);
        // Backend ayarlarında eşik varsa onu kullan
        if (
          dashboard.data.settings &&
          typeof dashboard.data.settings.emotion_threshold === "number"
        ) {
          threshold = dashboard.data.settings.emotion_threshold;
        }
      } else {
        // Fallback to local cache
        const result = await chrome.storage.local.get(["studentEmotions"]);
        const studentEmotions = result.studentEmotions || [];
        const now = Date.now();
        const recentData = studentEmotions.filter((d) => {
          const t = d.server_time || new Date(d.timestamp).getTime() || 0;
          return now - t < 120000; // son 2 dk
        });
        activeStudents = getLatestNonManualByStudent(recentData);
      }

      const names = Object.keys(activeStudents);
      studentCount.textContent = names.length;

      if (names.length === 0) {
        studentsList.innerHTML =
          '<div class="loading">Öğrenci verisi bekleniyor...</div>';
      } else {
        const html = names
          .map((name) => {
            const data = activeStudents[name];
            const emotion = (data.emotions && data.emotions[0]) || {};
            // Manuel geri bildirimler canlı listede gösterilmez
            if (emotion.source === "manual") return "";
            const ts = new Date(data.timestamp).getTime();
            const timeDiff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
            const conf = Math.round((emotion.confidence || 0) * 100);
            const emotionText =
              canonicalizeEmotion(emotion.emotion) || "Belirsiz";
            const displayText = translateEmotionTR(emotionText);
            const emoji = getEmotionEmoji(emotionText);
            const isManual = false;

            return `
            <div class="student-item">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div class="emotion-indicator" style="background: ${getEmotionColor(
                  emotionText
                )};"></div>
                <span style="font-weight: 500;">${name}</span>
                ${
                  isManual
                    ? '<span style="font-size: 10px; background: #3498db; color: white; padding: 2px 6px; border-radius: 8px;">📝 Manuel</span>'
                    : ""
                }
              </div>
              <div style="text-align: right;">
                <div style="font-size: 11px;">${emoji} ${displayText}</div>
                <div style="font-size: 9px; opacity: 0.7;">${conf}% • ${timeDiff}s önce</div>
              </div>
            </div>
          `;
          })
          .filter(Boolean)
          .join("");
        studentsList.innerHTML = html;
      }

      updateAlerts(activeStudents, threshold);
    } catch (error) {
      console.error("❌ updateStudentData hatası:", error);
    }
  }

  function updateAlerts(activeStudents, threshold = 0.7) {
    // Manuel feedback'ler sadece export'ta görünür, burada gösterme

    // Sadece model tarafından eğitilmiş negatif duygular
    const negativeSet = [
      "confused", // Kafası Karışık
      "frustrated", // Sıkıldı/Zorlanıyor/Hayal Kırıklığı
      "sleepy", // Uykulu
    ];
    const alertStudents = Object.keys(activeStudents).filter((studentName) => {
      const data = activeStudents[studentName];
      const emotion = (data.emotions && data.emotions[0]) || null;
      if (!emotion) return false;
      if (emotion.source === "manual") return false; // manuel bildirimleri atla
      const label = canonicalizeEmotion(emotion.emotion);
      const isNegative = negativeSet.some((n) => label.includes(n));
      return isNegative && (emotion.confidence || 0) >= threshold;
    });

    alertCount.textContent = alertStudents.length;

    if (alertStudents.length > 0) {
      alertSection.style.display = "block";
      alertList.innerHTML = alertStudents
        .map((studentName) => {
          const data = activeStudents[studentName];
          const emotion = (data.emotions && data.emotions[0]) || {};
          const emotionText =
            canonicalizeEmotion(emotion.emotion) || "Belirsiz";
          const emoji = getEmotionEmoji(emotionText);
          const displayText = translateEmotionTR(emotionText);
          return `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
            <span style="font-weight: 500;">${studentName}</span>
            <span style="font-size: 11px;">${emoji} ${displayText} (%${Math.round(
            (emotion.confidence || 0) * 100
          )})</span>
          </div>
        `;
        })
        .join("");
    } else {
      alertSection.style.display = "none";
    }
  }

  function getEmotionColor(emotion) {
    const emotionLower = canonicalizeEmotion(emotion);
    const colors = {
      // Model tarafından eğitilmiş duygular (6 kategori)
      confused: "#E67E22", // Turuncu - Kafası Karışık
      engaged: "#2ECC71", // Yeşil - Odaklı/İlgili
      frustrated: "#E74C3C", // Kırmızı - Sıkıldı/Zorlanıyor
      happy: "#F39C12", // Altın Sarısı - Mutlu
      neutral: "#BDC3C7", // Gri - Nötr
      sleepy: "#95A5A6", // Koyu Gri - Uykulu
    };
    return colors[emotionLower] || "#BDC3C7";
  }

  function getEmotionEmoji(emotion) {
    const emotionLower = canonicalizeEmotion(emotion);
    const emojis = {
      // Model tarafından eğitilmiş duygular (6 kategori)
      confused: "🤔", // Kafası Karışık
      engaged: "🎯", // Odaklı/İlgili
      frustrated: "😤", // Sıkıldı/Zorlanıyor
      happy: "😊", // Mutlu
      neutral: "😐", // Nötr
      sleepy: "😴", // Uykulu
    };
    return emojis[emotionLower] || "❓";
  }

  function exportData() {
    chrome.storage.local.get(["studentEmotions"], async function (result) {
      const localData = Array.isArray(result.studentEmotions)
        ? result.studentEmotions
        : [];

      // Backend'ten en güncel veriyi al (dashboard)
      let remoteData = [];
      try {
        const syncVals = await chrome.storage.sync.get([
          "serverUrl",
          "backendUrl",
          "teacherApiKey",
        ]);
        const baseUrl = (
          syncVals.serverUrl ||
          syncVals.backendUrl ||
          "http://127.0.0.1:5001"
        ).replace(/\/$/, "");
        const apiKey = syncVals.teacherApiKey || "";
        const dashboard = await new Promise((resolve) =>
          chrome.runtime.sendMessage(
            { action: "GET_DASHBOARD", baseUrl, apiKey },
            (res) => resolve(res)
          )
        );
        if (
          dashboard &&
          dashboard.success &&
          dashboard.data &&
          dashboard.data.success &&
          Array.isArray(dashboard.data.recent_emotions)
        ) {
          remoteData = dashboard.data.recent_emotions;
        }
      } catch (e) {
        // arka uç erişimi başarısız olabilir; yalnızca local ile devam et
      }

      // Birleştir (öğrenci + zaman anahtarı ile tekrarı engelle)
      const toMillis = (ts, server_time) => {
        if (typeof server_time === "number") return server_time;
        const n = Number(ts);
        if (!isNaN(n) && isFinite(n)) return n;
        const d = new Date(ts).getTime();
        return isFinite(d) ? d : 0;
      };
      const byKey = new Map();
      const add = (rec) => {
        const name = rec.studentName || rec.student || "";
        const ms = toMillis(rec.timestamp, rec.server_time);
        const key = `${name}|${ms}`;
        if (!byKey.has(key)) byKey.set(key, rec);
      };
      remoteData.forEach(add);
      localData.forEach(add);
      const studentData = Array.from(byKey.values());

      if (studentData.length === 0) {
        alert("📊 Henüz analiz verisi bulunmuyor!");
        return;
      }

      // Enriched JSON format (same as control panel):
      // [{ studentName, emotion, confidence, timestamp, localTime, time, raw }]
      const enriched = studentData.map((data) => {
        const e = (data.emotions && data.emotions[0]) || {};
        const ts = toMillis(data.timestamp, data.server_time);
        return {
          studentName: data.studentName || "",
          emotion: e.emotion || "Belirsiz",
          confidence: Math.round((e.confidence || 0) * 100),
          timestamp: ts,
          localTime: new Date(ts).toLocaleString(),
          time: new Date(ts).toISOString(),
          raw: data,
        };
      });

      const blob = new Blob([JSON.stringify(enriched, null, 2)], {
        type: "application/json;charset=utf-8;",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `ai-sinif-analizi-${
        new Date().toISOString().split("T")[0]
      }.json`;
      link.click();

      console.log(
        `📥 JSON veri indirildi. Kayıt sayısı: ${studentData.length}`
      );
      alert(`✅ JSON verisi indirildi (Toplam ${studentData.length} kayıt).`);
    });
  }

  async function clearData() {
    if (
      confirm(
        "🗑️ Tüm analiz verilerini silmek istediğinize emin misiniz?\\n\\nBu işlem geri alınamaz!"
      )
    ) {
      // Hem local hem server'dan temizle
      try {
        const syncVals = await chrome.storage.sync.get([
          "serverUrl",
          "backendUrl",
          "teacherApiKey",
        ]);
        const baseUrl = (
          syncVals.serverUrl ||
          syncVals.backendUrl ||
          "http://127.0.0.1:5001"
        ).replace(/\/$/, "");
        const apiKey = syncVals.teacherApiKey || "";

        await new Promise((resolve) => {
          chrome.storage.local.remove(["studentEmotions"], resolve);
        });

        // clear server via background proxy to avoid CORS/SSL issues
        await new Promise((resolve) =>
          chrome.runtime.sendMessage(
            {
              action: "NETWORK_REQUEST",
              url: `${baseUrl}/clear-data`,
              method: "POST",
              headers: {
                "X-API-KEY": apiKey,
                "Content-Type": "application/json",
              },
              teacherApiKey: apiKey,
              timeout: 8000,
            },
            () => resolve()
          )
        );

        updateStudentData();
        alert("✅ Veriler başarıyla temizlendi!");
      } catch (error) {
        console.error("Clear data error:", error);
        alert("⚠️ Veri temizleme sırasında hata oluştu");
      }
    }
  }

  exportBtn.addEventListener("click", exportData);
  clearBtn.addEventListener("click", clearData);

  settingsBtn.addEventListener("click", function () {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
    window.close();
  });

  refreshBtn.addEventListener("click", function () {
    updateStudentData();
  });

  loadTeacherInfo();
  updateStudentData();

  setInterval(updateStudentData, 3000);
});
