console.log("👨‍🏫 AI Sınıf Kontrolü - Öğretmen Paneli Aktif!");

// Platform detection functions - Enhanced 2025
function getCurrentPlatform() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  const currentUrl = window.location.href;

  if (hostname === "meet.google.com") {
    return "meet";
  } else if (
    hostname.includes("zoom.us") ||
    hostname.includes("zoom.com") ||
    currentUrl.includes("/wc/") ||
    currentUrl.includes("/j/") ||
    currentUrl.includes("/meeting/")
  ) {
    return "zoom";
  } else if (
    pathname.includes("/html5client/") ||
    pathname.includes("/bigbluebutton/") ||
    hostname.includes("bigbluebutton") ||
    hostname.includes("bbb") ||
    // Check for BBB indicators in DOM
    document.querySelector('div[data-test="joinAudio"]') ||
    document.querySelector('div[class*="bigbluebutton"]')
  ) {
    return "bbb";
  }
  return "none";
}

function isInMeetingPage() {
  const currentUrl = window.location.href;
  const platform = getCurrentPlatform();

  switch (platform) {
    case "meet":
      // Enhanced Meet room patterns
      return (
        currentUrl.match(/meet\.google\.com\/[a-z0-9\-]{8,}(\/.*)?$/) ||
        currentUrl.includes("/lookup/") ||
        currentUrl.includes("/room/")
      );
    case "zoom":
      // Enhanced Zoom patterns - more comprehensive
      return (
        currentUrl.includes("/wc/") ||
        currentUrl.includes("/j/") ||
        currentUrl.includes("/meeting/") ||
        currentUrl.match(/\/\d{9,11}/) || // Meeting ID pattern
        document.querySelector('div[id*="zoom-ui"]') !== null
      );
    case "bbb":
      // Enhanced BigBlueButton patterns
      return (
        currentUrl.includes("/html5client/") ||
        currentUrl.includes("/bigbluebutton/") ||
        document.querySelector('div[data-test="audioModal"]') !== null ||
        document.querySelector('div[class*="bigbluebutton"]') !== null
      );
    default:
      return false;
  }
}

let userId, userName;
let analysisActive = false;
let emotionDisplay, controlPanel;
let backendUrl = "http://127.0.0.1:5001";
let settings = {
  analysisInterval: 3000,
  emotionThreshold: 0.7,
  alertsEnabled: true,
  backendUrl: "http://127.0.0.1:5001",
  teacherApiKey: "",
  debugMode: false,
};

async function getBackendUrl() {
  try {
    const result = await chrome.storage.sync.get(["backendUrl"]);
    if (result.backendUrl) {
      backendUrl = result.backendUrl;
      settings.backendUrl = result.backendUrl;
      console.log(`🔗 Backend URL ayarlandı: ${backendUrl}`);
    }
    return backendUrl;
  } catch (error) {
    console.warn("⚠️ Backend URL alınamadı, varsayılan kullanılıyor:", error);
    return backendUrl;
  }
}

async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get([
      "analysisInterval",
      "emotionThreshold",
      "alertsEnabled",
      "backendUrl",
      "teacherApiKey",
      "debugMode",
    ]);

    settings = {
      analysisInterval: result.analysisInterval || 3000,
      emotionThreshold: result.emotionThreshold || 0.7,
      alertsEnabled: result.alertsEnabled !== false,
      backendUrl: result.backendUrl || "http://127.0.0.1:5001",
      teacherApiKey: result.teacherApiKey || "",
      debugMode: result.debugMode || false,
    };

    backendUrl = settings.backendUrl;
    console.log("⚙️ Öğretmen ayarları yüklendi:", {
      ...settings,
      teacherApiKey: settings.teacherApiKey ? "✅ Mevcut" : "❌ Eksik",
    });
  } catch (error) {
    console.error("❌ Ayar yükleme hatası:", error);
  }
}

async function initializeTeacher() {
  try {
    const result = await chrome.storage.local.get(["userId", "userName"]);

    if (result.userId && result.userName) {
      userId = result.userId;
      userName = result.userName;
      console.log(`👨‍🏫 Öğretmen: ${userName} (${userId})`);
      return { userId, userName };
    }

    const teacherInfo = await requestTeacherInfo();
    if (teacherInfo) {
      userId = teacherInfo.userId;
      userName = teacherInfo.userName;

      await chrome.storage.local.set({
        userId,
        userName,
        userRole: "teacher",
      });

      console.log(`✅ Öğretmen kaydedildi: ${userName} (${userId})`);
      return teacherInfo;
    }
  } catch (error) {
    console.error("❌ Öğretmen başlatma hatası:", error);
  }
  return null;
}

function requestTeacherInfo() {
  return new Promise((resolve) => {
    const modal = createTeacherModal();
    document.body.appendChild(modal);

    const nameInput = modal.querySelector("#teacher-name-input");
    const submitBtn = modal.querySelector("#submit-teacher-info");
    const cancelBtn = modal.querySelector("#cancel-teacher-info");

    submitBtn.onclick = () => {
      const name = nameInput.value.trim();
      if (name && name.length >= 2) {
        const userId = generateUserId();
        modal.remove();
        resolve({ userId, userName: name });
      } else {
        nameInput.style.border = "2px solid #E74C3C";
        nameInput.placeholder = "En az 2 karakter girmelisiniz";
      }
    };

    cancelBtn.onclick = () => {
      modal.remove();
      resolve(null);
    };

    nameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        submitBtn.click();
      }
    });

    setTimeout(() => nameInput.focus(), 100);
  });
}

function createTeacherModal() {
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  modal.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 25px 80px rgba(0,0,0,0.4);
      max-width: 450px;
      width: 90%;
      text-align: center;
      border: 3px solid rgba(255,255,255,0.2);
    ">
      <h2 style="margin: 0 0 10px 0; font-size: 28px;">👨‍🏫 Öğretmen Paneli</h2>
      <p style="margin: 0 0 30px 0; opacity: 0.9; font-size: 16px;">
        AI Duygu Analizi Kontrol Sistemi
      </p>
      
      <input 
        type="text" 
        id="teacher-name-input"
        placeholder="Öğretmen adınızı girin"
        style="
          width: 100%;
          padding: 18px;
          font-size: 16px;
          border: none;
          border-radius: 12px;
          margin-bottom: 25px;
          box-sizing: border-box;
          outline: none;
          background: rgba(255,255,255,0.95);
          color: #333;
        "
      />
      
      <div style="display: flex; gap: 15px;">
        <button id="cancel-teacher-info" style="
          flex: 1;
          padding: 15px;
          background: rgba(255,255,255,0.2);
          color: white;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 12px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
        ">İptal</button>
        
        <button id="submit-teacher-info" style="
          flex: 2;
          padding: 15px;
          background: rgba(255,255,255,0.95);
          color: #667eea;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 700;
        ">Sistem Başlat</button>
      </div>
      
      <p style="font-size: 12px; margin: 25px 0 0 0; opacity: 0.8;">
        🔒 Bu panel sadece öğretmen kontrolündedir
      </p>
    </div>
  `;

  return modal;
}

function generateUserId() {
  return (
    "teacher_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)
  );
}

function createTeacherControlPanel() {
  if (controlPanel) return;

  controlPanel = document.createElement("div");
  controlPanel.id = "teacher-control-panel";
  controlPanel.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 400px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    z-index: 9999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    border: 2px solid rgba(255,255,255,0.2);
  `;

  controlPanel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="margin: 0; font-size: 18px;">👨‍🏫 Öğretmen Kontrolü</h3>
      <button id="minimize-panel" style="
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        padding: 5px 10px;
        border-radius: 5px;
        cursor: pointer;
      ">−</button>
    </div>
    
    <div id="student-list">
      <h4 style="margin: 0 0 10px 0; font-size: 16px;">📊 Aktif Öğrenciler</h4>
      <div id="students-container" style="
        max-height: 300px;
        overflow-y: auto;
        background: rgba(255,255,255,0.1);
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 15px;
      ">
        <p style="text-align: center; opacity: 0.7; margin: 20px 0;">
          Öğrenci verisi bekleniyor...
        </p>
      </div>
    </div>
    
    <div style="display: flex; gap: 10px;">
      <button id="export-data" style="
        flex: 1;
        padding: 10px;
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        border-radius: 8px;
        cursor: pointer;
      ">📊 Veri İndir</button>
      <button id="clear-data" style="
        flex: 1;
        padding: 10px;
        background: rgba(255,255,255,0.1);
        border: none;
        color: white;
        border-radius: 8px;
        cursor: pointer;
      ">🗑️ Temizle</button>
    </div>
  `;

  document.body.appendChild(controlPanel);

  const minimizeBtn = controlPanel.querySelector("#minimize-panel");
  const studentsContainer = controlPanel.querySelector("#students-container");
  let isMinimized = false;

  minimizeBtn.onclick = () => {
    isMinimized = !isMinimized;
    if (isMinimized) {
      controlPanel.querySelector("#student-list").style.display = "none";
      controlPanel.style.width = "200px";
      minimizeBtn.textContent = "+";
    } else {
      controlPanel.querySelector("#student-list").style.display = "block";
      controlPanel.style.width = "400px";
      minimizeBtn.textContent = "−";
    }
  };

  controlPanel.querySelector("#export-data").onclick = exportStudentDataJSON;
  // JSON butonu kaldırıldı; 'Veri İndir' zaten JSON indirir
  controlPanel.querySelector("#clear-data").onclick = clearStudentData;

  // Start polling dashboard from backend (primary), fallback to local storage
  loadDashboardData();
  setInterval(loadDashboardData, 3000);

  // Draggable panel
  makePanelDraggable(controlPanel);
}

async function loadStudentData() {
  try {
    // Extension context invalidation kontrolü
    if (!chrome.storage || !chrome.storage.local) {
      console.warn("🔄 Chrome storage erişimi yok, extension reload gerekli");
      return;
    }

    const result = await chrome.storage.local.get(["studentEmotions"]);
    const studentData = result.studentEmotions || [];

    const container = document.querySelector("#students-container");
    if (!container) return;

    if (studentData.length === 0) {
      container.innerHTML = `
        <p style="text-align: center; opacity: 0.7; margin: 20px 0;">
          Öğrenci verisi bekleniyor...
        </p>
      `;
      return;
    }

    // Son 60 sn içindeki en güncel OTOMATİK (manuel olmayan) kaydı öğrenci bazında seç
    const recentData = studentData
      .filter((data) => Date.now() - data.timestamp < 60000)
      .reduce((acc, data) => {
        const e = (data.emotions && data.emotions[0]) || null;
        if (!e || e.source === "manual") return acc; // manuel geri bildirimleri canlıda gösterme
        const name = data.studentName;
        const t =
          Number(data.timestamp) || new Date(data.timestamp).getTime() || 0;
        const prev = acc[name];
        if (!prev) {
          acc[name] = data;
        } else {
          const pt =
            Number(prev.timestamp) || new Date(prev.timestamp).getTime() || 0;
          if (t > pt) acc[name] = data;
        }
        return acc;
      }, {});

    container.innerHTML = Object.keys(recentData)
      .map((studentName) => {
        const data = recentData[studentName];
        const emotion = data.emotions[0];
        const timeDiff = Math.floor((Date.now() - data.timestamp) / 1000);

        return `
        <div style="
          background: rgba(255,255,255,0.1);
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 8px;
          border-left: 4px solid ${getEmotionColor(emotion?.emotion)};
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong>${studentName}</strong>
            <span style="font-size: 12px; opacity: 0.8;">${timeDiff}s önce</span>
          </div>
          <div style="font-size: 12px; margin-top: 5px;">
            ${emotion?.emotion || "Belirsiz"}: %${Math.round(
          (emotion?.confidence || 0) * 100
        )}
          </div>
        </div>
      `;
      })
      .join("");
  } catch (error) {
    console.error("❌ Öğrenci verisi yükleme hatası:", error);

    // Extension context invalidation kontrolü
    if (
      error.message &&
      error.message.includes("Extension context invalidated")
    ) {
      console.error("🔄 Extension context invalidated - reload gerekli");
      const container = document.querySelector("#students-container");
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; padding: 20px; background: rgba(255,0,0,0.1); border-radius: 8px; color: #ff6b6b;">
            <h4>🔄 Extension Güncelleme Gerekli</h4>
            <p>Extension context invalidated</p>
            <p><small>chrome://extensions/ → Teacher Extension → Reload</small></p>
          </div>
        `;
      }
    }
  }
}

async function loadDashboardData() {
  try {
    // Ensure we have server URL (prefer 'serverUrl' from options, fallback 'backendUrl') and api key
    const syncVals = await chrome.storage.sync.get([
      "serverUrl",
      "backendUrl",
      "teacherApiKey",
    ]);
    const baseUrl = (
      syncVals.serverUrl ||
      syncVals.backendUrl ||
      backendUrl ||
      ""
    ).replace(/\/$/, "");
    const apiKey = syncVals.teacherApiKey || settings.teacherApiKey || "";

    const response = await new Promise((resolve) =>
      chrome.runtime.sendMessage(
        { action: "GET_DASHBOARD", baseUrl: baseUrl, apiKey: apiKey },
        (res) => resolve(res)
      )
    );

    const container = document.querySelector("#students-container");
    if (!container) return;

    if (
      !response ||
      !response.success ||
      !response.data ||
      !response.data.success
    ) {
      // Fallback to local data
      return await loadStudentData();
    }

    const data = response.data;
    const recent = data.recent_emotions || [];

    if (recent.length === 0) {
      container.innerHTML = `
        <p style="text-align: center; opacity: 0.7; margin: 20px 0;">
          Öğrenci verisi bekleniyor...
        </p>
      `;
      return;
    }

    // Öğrenci bazında en güncel OTOMATİK (manuel olmayan) kaydı seç
    const latestByStudent = {};
    for (const item of recent) {
      const e = (item.emotions && item.emotions[0]) || null;
      if (!e || e.source === "manual") continue; // manuel geri bildirimleri canlıda gösterme
      const name = item.studentName;
      // timestamp'ı güvenli şekilde ms'e çevir
      let t = 0;
      try {
        t = new Date(item.timestamp).getTime();
        if (!isFinite(t)) t = Number(item.timestamp) || 0;
      } catch {
        t = Number(item?.timestamp) || 0;
      }
      if (!latestByStudent[name]) {
        latestByStudent[name] = item;
      } else {
        let pt = 0;
        try {
          pt = new Date(latestByStudent[name].timestamp).getTime();
          if (!isFinite(pt)) pt = Number(latestByStudent[name].timestamp) || 0;
        } catch {
          pt = Number(latestByStudent[name]?.timestamp) || 0;
        }
        if (t > pt) latestByStudent[name] = item;
      }
    }

    container.innerHTML = Object.keys(latestByStudent)
      .map((name) => {
        const item = latestByStudent[name];
        const emotion = (item.emotions && item.emotions[0]) || {};
        const ts = new Date(item.timestamp).getTime();
        const timeDiff = Math.max(0, Math.floor((Date.now() - ts) / 1000));

        return `
          <div style="
            background: rgba(255,255,255,0.1);
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 8px;
            border-left: 4px solid ${getEmotionColor(emotion.emotion)};
          ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>${name}</strong>
              <span style="font-size: 12px; opacity: 0.8;">${timeDiff}s önce</span>
            </div>
            <div style="font-size: 12px; margin-top: 5px;">
              ${emotion.emotion || "Belirsiz"}: %${Math.round(
          (emotion.confidence || 0) * 100
        )}
            </div>
          </div>
        `;
      })
      .join("");

    // Trigger alerts based on settings
    if (settings.alertsEnabled) {
      maybeShowAlerts(latestByStudent, settings.emotionThreshold || 0.7);
      // Her analiz turunda en baskın sınıf duygusunu küçük popup olarak göster
      const maxTs = Object.values(latestByStudent)
        .map((it) => {
          let t = 0;
          try {
            t = new Date(it.timestamp).getTime();
            if (!isFinite(t)) t = Number(it.timestamp) || 0;
          } catch {
            t = Number(it?.timestamp) || 0;
          }
          return t;
        })
        .reduce((a, b) => Math.max(a, b), 0);
      if (maxTs && maxTs !== lastClassAnalysisTs) {
        lastClassAnalysisTs = maxTs;
        maybeShowDominantClassPopup(
          latestByStudent,
          settings.emotionThreshold || 0.7
        );
      }
    }
  } catch (error) {
    console.error("❌ Dashboard yükleme hatası:", error);
    // Fallback silently to local storage rendering
    await loadStudentData();
  }
}

function getEmotionColor(emotion) {
  const colors = {
    Happy: "#2ECC71",
    Sad: "#3498DB",
    Angry: "#E74C3C",
    Fear: "#9B59B6",
    Surprise: "#F39C12",
    Disgust: "#95A5A6",
    Neutral: "#BDC3C7",
  };
  return colors[emotion] || "#BDC3C7";
}

async function exportStudentData() {
  try {
    const studentData = await gatherFullEmotionData();

    if (studentData.length === 0) {
      alert("📊 Henüz veri bulunmuyor!");
      return;
    }

    const header = "\uFEFFTarih,Öğrenci,Duygu,Güven,Zaman"; // BOM for Excel
    const csvContent = [
      header,
      ...studentData.map((data) => {
        const emotion = data.emotions?.[0] || {};
        const ts = toMillis(data.timestamp);
        const dateStr = new Date(ts).toLocaleString();
        const name = (data.studentName || "").replace(/[\,\n]/g, " ");
        const label = String(emotion.emotion || "Belirsiz").replace(
          /[\,\n]/g,
          " "
        );
        const conf = Math.round((emotion.confidence || 0) * 100);
        const timeStr = new Date(ts).toISOString();
        return `${dateStr},${name},${label},${conf}%,${timeStr}`;
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ai-sinif-analizi-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    link.click();

    console.log("📊 Veri başarıyla indirildi!");
  } catch (error) {
    console.error("❌ Veri indirme hatası:", error);
  }
}

async function exportStudentDataJSON() {
  try {
    const studentData = await gatherFullEmotionData();

    if (studentData.length === 0) {
      alert("📊 Henüz veri bulunmuyor!");
      return;
    }

    // İndirilecek veriyi isim, saat/dakika ve ISO zaman bilgileriyle zenginleştir (ve ham kaydı ekle)
    const enriched = studentData.map((d) => {
      const ts = toMillis(d.timestamp);
      return {
        studentName: d.studentName || "",
        emotion: d.emotions?.[0]?.emotion || "Belirsiz",
        confidence: Math.round((d.emotions?.[0]?.confidence || 0) * 100),
        timestamp: ts,
        localTime: new Date(ts).toLocaleString(),
        time: new Date(ts).toISOString(),
        raw: d,
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

    console.log("📥 JSON veri başarıyla indirildi!");
  } catch (error) {
    console.error("❌ JSON veri indirme hatası:", error);
  }
}

// Yardımcı: dashboard’taki en güncel veriyi local ile birleştir
async function gatherFullEmotionData() {
  // Local veriyi al
  const result = await chrome.storage.local.get(["studentEmotions"]);
  const localData = Array.isArray(result.studentEmotions)
    ? result.studentEmotions
    : [];

  // Backend’ten o anki en güncel veriyi al (dashboard)
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
      backendUrl ||
      ""
    ).replace(/\/$/, "");
    const apiKey = syncVals.teacherApiKey || settings.teacherApiKey || "";
    const response = await new Promise((resolve) =>
      chrome.runtime.sendMessage(
        { action: "GET_DASHBOARD", baseUrl: baseUrl, apiKey: apiKey },
        (res) => resolve(res)
      )
    );
    if (
      response &&
      response.success &&
      response.data &&
      response.data.success
    ) {
      remoteData = Array.isArray(response.data.recent_emotions)
        ? response.data.recent_emotions
        : [];
    }
  } catch (e) {
    // backend erişilemezse sadece local kullanılacak
  }

  // Birleştir ve tekrarları (öğrenci+timestamp) ayıkla
  const byKey = new Map();
  const add = (rec) => {
    const name = rec.studentName || rec.student || "";
    const ts = toMillis(rec.timestamp);
    const key = `${name}|${ts}`;
    if (!byKey.has(key)) byKey.set(key, rec);
  };
  remoteData.forEach(add);
  localData.forEach(add);

  // Zaman sıralı dizi olarak dön
  return Array.from(byKey.values()).sort(
    (a, b) => toMillis(a.timestamp) - toMillis(b.timestamp)
  );
}

function toMillis(ts) {
  if (typeof ts === "number") return ts;
  const n = Number(ts);
  if (!isNaN(n) && isFinite(n)) return n;
  const d = new Date(ts).getTime();
  return isFinite(d) ? d : 0;
}

async function clearStudentData() {
  if (confirm("🗑️ Tüm öğrenci verilerini silmek istediğinize emin misiniz?")) {
    try {
      await chrome.storage.local.remove(["studentEmotions"]);
      // Also clear on server via background
      const syncVals = await chrome.storage.sync.get([
        "serverUrl",
        "backendUrl",
        "teacherApiKey",
      ]);
      const baseUrl = (
        syncVals.serverUrl ||
        syncVals.backendUrl ||
        backendUrl ||
        ""
      ).replace(/\/$/, "");
      const apiKey = syncVals.teacherApiKey || settings.teacherApiKey || "";
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
          },
          () => resolve()
        )
      );
      loadDashboardData();
      console.log("🗑️ Öğrenci verileri temizlendi!");
    } catch (error) {
      console.error("❌ Veri temizleme hatası:", error);
    }
  }
}

// Simple duplicate alert suppression and TR/EN mapping (negative & focus)
let recentAlertKeys = [];
// Sınıf bazında: her analiz turunda en fazla bir sınıf popup'ı
let lastClassAnalysisTs = 0;
// Bir analiz sonuç turu başına, öğrenci başına en fazla bir popup için takip
let lastShownAnalysisTsByStudent = {}; // { [name]: number }

// Per-student last shown category and timestamp to rate-limit popups
const ALERT_COOLDOWNS = {
  frustrated: 60000, // 1 dakika
  confused: 60000,
  focused: 60000,
  sleepy: 180000, // 3 dakika (Mutlu/Uykulu daha seyrek bildirilsin)
  happy: 180000,
  otherNeg: 60000,
};
let lastAlertByStudent = {}; // { [name]: { category: string, timestamp: number } }

function getCategoryForLabel(labelLower) {
  const frustratedSet = [
    "sıkılmış",
    "yılmış",
    "bored",
    "frustrated",
    "zorlanıyor",
  ];
  const confusedSet = ["kafası karışmış", "confused"];
  const focusedSet = ["odaklanmış", "focused", "odak"];
  const sleepySet = ["uykulu", "sleepy"];
  const happySet = ["mutlu", "happy"];
  const otherNeg = ["üzgün", "kızgın", "sad", "angry", "fear", "disgust"];

  if (frustratedSet.some((n) => labelLower.includes(n))) return "frustrated";
  if (confusedSet.some((n) => labelLower.includes(n))) return "confused";
  if (focusedSet.some((n) => labelLower.includes(n))) return "focused";
  if (sleepySet.some((n) => labelLower.includes(n))) return "sleepy";
  if (happySet.some((n) => labelLower.includes(n))) return "happy";
  if (otherNeg.some((n) => labelLower.includes(n))) return "otherNeg";
  return null;
}

function shouldShowEmotionAlert(name, labelLower, conf, threshold) {
  if (conf < threshold) return false;
  const category = getCategoryForLabel(labelLower);
  if (!category) return false;
  const now = Date.now();
  const last = lastAlertByStudent[name];
  const cooldown = ALERT_COOLDOWNS[category] || 60000;
  if (last && last.category === category && now - last.timestamp < cooldown) {
    return false;
  }
  lastAlertByStudent[name] = { category, timestamp: now };
  return true;
}

function maybeShowAlerts(latestByStudent, threshold) {
  // Categories
  const frustratedSet = [
    "sıkılmış",
    "yılmış",
    "bored",
    "frustrated",
    "zorlanıyor",
  ];
  const confusedSet = ["kafası karışmış", "confused"];
  const focusedSet = ["odaklanmış", "focused", "odak"];
  const sleepySet = ["uykulu", "sleepy"];
  const happySet = ["mutlu", "happy"];
  const otherNeg = ["üzgün", "kızgın", "sad", "angry", "fear", "disgust"];

  const now = Date.now();
  // keep last 50
  if (recentAlertKeys.length > 50) recentAlertKeys = recentAlertKeys.slice(-50);

  for (const name of Object.keys(latestByStudent)) {
    const item = latestByStudent[name];
    // Aynı analiz sonucunda tekrar popup göstermemek için ts kontrolü
    let itemTs = 0;
    try {
      itemTs = new Date(item.timestamp).getTime();
      if (!isFinite(itemTs)) itemTs = Number(item.timestamp) || 0;
    } catch {
      itemTs = Number(item?.timestamp) || 0;
    }
    if (itemTs && lastShownAnalysisTsByStudent[name] === itemTs) {
      continue; // bu analiz turu için zaten gösterildi
    }
    const e = (item.emotions && item.emotions[0]) || {};
    const rawLabel = String(e.emotion || "");
    const label = rawLabel.toLowerCase();
    const conf = e.confidence || 0;

    const isFrustrated = frustratedSet.some((n) => label.includes(n));
    const isConfused = confusedSet.some((n) => label.includes(n));
    const isFocused = focusedSet.some((n) => label.includes(n));
    const isSleepy = sleepySet.some((n) => label.includes(n));
    const isHappy = happySet.some((n) => label.includes(n));
    const isOtherNeg = otherNeg.some((n) => label.includes(n));

    // Trigger for categories when above threshold with cooldown per student/category
    if (
      isFrustrated ||
      isConfused ||
      isFocused ||
      isSleepy ||
      isHappy ||
      isOtherNeg
    ) {
      if (shouldShowEmotionAlert(name, label, conf, threshold)) {
        showEmotionAlert(name, { emotion: rawLabel, confidence: conf });
        if (itemTs) lastShownAnalysisTsByStudent[name] = itemTs;
      }
    }
  }
}

// Aggregate summary toast (counts for frustrated/confused/focused/sleepy/happy)
let lastAggregateSignature = "";
function maybeShowAggregateSummary(latestByStudent, threshold) {
  try {
    let frustrated = 0,
      confused = 0,
      focused = 0,
      sleepy = 0,
      happy = 0;

    const frustratedSet = [
      "sıkılmış",
      "yılmış",
      "bored",
      "frustrated",
      "zorlanıyor",
    ];
    const confusedSet = ["kafası karışmış", "confused"];
    const focusedSet = ["odaklanmış", "focused", "odak"];
    const sleepySet = ["uykulu", "sleepy"];
    const happySet = ["mutlu", "happy"];

    for (const name of Object.keys(latestByStudent)) {
      const item = latestByStudent[name];
      const e = (item.emotions && item.emotions[0]) || {};
      const label = String(e.emotion || "").toLowerCase();
      const conf = e.confidence || 0;
      if (conf < threshold) continue;

      if (frustratedSet.some((n) => label.includes(n))) frustrated++;
      else if (confusedSet.some((n) => label.includes(n))) confused++;
      else if (focusedSet.some((n) => label.includes(n))) focused++;
      else if (sleepySet.some((n) => label.includes(n))) sleepy++;
      else if (happySet.some((n) => label.includes(n))) happy++;
    }

    const sig = `${frustrated}|${confused}|${focused}|${sleepy}|${happy}`;
    // Only show if changed and at least one is non-zero
    if (
      sig !== lastAggregateSignature &&
      (frustrated || confused || focused || sleepy || happy)
    ) {
      lastAggregateSignature = sig;
      showAggregateAlert({ frustrated, confused, focused, sleepy, happy });
    }
  } catch (e) {
    // no-op
  }
}

function showAggregateAlert(counts) {
  const id = "teacher-aggregate-toast";
  let toast = document.getElementById(id);
  const makePill = (colorBg, colorText, label, value) => `
    <span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-weight:700;background:${colorBg};color:${colorText};min-width:80px;justify-content:center;">
      ${label}: ${value}
    </span>`;

  const content = `
    <div style=\"display:flex;flex-direction:column;gap:8px;\">\n      <div style=\"font-weight:700;\">Sınıf Durumu</div>\n      <div style=\"display:flex;gap:8px;flex-wrap:wrap;\">\n        ${makePill(
      "rgba(231,76,60,0.2)",
      "#E74C3C",
      "Sıkılmış/Zorlanıyor",
      counts.frustrated || 0
    )}\n        ${makePill(
    "rgba(52,152,219,0.2)",
    "#3498DB",
    "Kafası Karışmış",
    counts.confused
  )}\n        ${makePill(
    "rgba(46,204,113,0.2)",
    "#2ECC71",
    "Odaklanmış",
    counts.focused
  )}\n        ${makePill(
    "rgba(142,68,173,0.2)",
    "#8E44AD",
    "Uykulu",
    counts.sleepy || 0
  )}\n        ${makePill(
    "rgba(241,196,15,0.2)",
    "#F1C40F",
    "Mutlu",
    counts.happy || 0
  )}\n      </div>\n    </div>`;

  if (!toast) {
    toast = document.createElement("div");
    toast.id = id;
    toast.style.cssText = `
      position: fixed;
      bottom: 90px;
      right: 20px;
      background: rgba(255,255,255,0.95);
      color: #2c3e50;
      padding: 14px 16px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      z-index: 10000001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 360px;
      border: 1px solid rgba(0,0,0,0.06);
      animation: slideIn 0.4s ease;
    `;
    document.body.appendChild(toast);
  }

  toast.innerHTML = content;

  // Auto hide after 6s, but refresh timer on updates
  clearTimeout(toast.__hideTimer);
  toast.__hideTimer = setTimeout(() => {
    try {
      toast.style.animation = "slideOut 0.4s ease";
      setTimeout(() => toast.remove(), 400);
    } catch {}
  }, 6000);
}

function makePanelDraggable(panel) {
  let isDragging = false;
  let startX = 0,
    startY = 0,
    origX = 0,
    origY = 0;
  const header = panel.querySelector("h3");
  const handle = header?.parentElement || panel;

  handle.style.cursor = "move";
  handle.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    origX = rect.left;
    origY = rect.top;
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    panel.style.left = `${origX + dx}px`;
    panel.style.top = `${origY + dy}px`;
    panel.style.right = "auto";
    panel.style.position = "fixed";
  });
  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "STUDENT_EMOTION_DATA") {
    console.log("📊 Öğrenci duygu verisi alındı:", message.data);
    saveStudentEmotion(message.data);
    sendResponse({ status: "received" });
  }
});

async function saveStudentEmotion(emotionData) {
  try {
    const result = await chrome.storage.local.get(["studentEmotions"]);
    const studentEmotions = result.studentEmotions || [];

    studentEmotions.push({
      ...emotionData,
      timestamp: Date.now(),
    });

    await chrome.storage.local.set({ studentEmotions });

    if (settings.alertsEnabled && emotionData.emotions[0]) {
      const emotion = emotionData.emotions[0];
      const label = (emotion.emotion || "").toLowerCase();
      const isNegative = [
        "yılmış", // Turkish
        "kafası karışmış",
        "uykulu",
        "üzgün",
        "kızgın",
        "sad",
        "angry",
        "fear",
        "disgust",
        "sleepy",
      ].some((neg) => label.includes(neg));

      const conf = emotion.confidence || 0;
      if (isNegative && conf > settings.emotionThreshold) {
        // Respect per-student/category cooldown
        if (
          shouldShowEmotionAlert(
            emotionData.studentName,
            label,
            conf,
            settings.emotionThreshold
          )
        ) {
          showEmotionAlert(emotionData.studentName, emotion);
        }
      }
    }
  } catch (error) {
    console.error("❌ Öğrenci duygu verisi kaydetme hatası:", error);
  }
}

function showEmotionAlert(studentName, emotion) {
  const colors = getAlertColors(String(emotion.emotion || ""));
  const alert = document.createElement("div");
  alert.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(45deg, ${colors.from}, ${colors.to});
    color: white;
    padding: 15px 20px;
    border-radius: 10px;
    box-shadow: 0 10px 25px ${colors.shadow};
    z-index: 10000000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 320px;
    animation: slideIn 0.5s ease;
  `;

  const icon = colors.icon;
  alert.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 20px;">${icon}</span>
      <div>
        <div style="font-weight: bold;">${studentName}</div>
        <div style="font-size: 12px; opacity: 0.9;">
          ${emotion.emotion} (%${Math.round((emotion.confidence || 0) * 100)})
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(alert);

  setTimeout(() => {
    alert.style.animation = "slideOut 0.5s ease";
    setTimeout(() => alert.remove(), 500);
  }, 4000);
}

function getAlertColors(label) {
  const l = label.toLowerCase();
  // Red tones for bored/negative
  if (
    l.includes("sıkılmış") ||
    l.includes("yılmış") ||
    l.includes("bored") ||
    l.includes("angry") ||
    l.includes("kızgın") ||
    l.includes("sad") ||
    l.includes("üzgün") ||
    l.includes("fear") ||
    l.includes("disgust")
  ) {
    return {
      from: "#E74C3C",
      to: "#C0392B",
      shadow: "rgba(231, 76, 60, 0.3)",
      icon: "⚠️",
    };
  }
  // Purple for sleepy
  if (l.includes("uykulu") || l.includes("sleepy")) {
    return {
      from: "#9B59B6",
      to: "#8E44AD",
      shadow: "rgba(155, 89, 182, 0.3)",
      icon: "💤",
    };
  }
  // Blue for confused
  if (l.includes("kafası karışmış") || l.includes("confus")) {
    return {
      from: "#3498DB",
      to: "#2980B9",
      shadow: "rgba(52, 152, 219, 0.3)",
      icon: "🌀",
    };
  }
  // Green for focused
  if (l.includes("odaklan") || l.includes("focused") || l.includes("odak")) {
    return {
      from: "#2ECC71",
      to: "#27AE60",
      shadow: "rgba(46, 204, 113, 0.3)",
      icon: "✅",
    };
  }
  // Gold for happy
  if (l.includes("mutlu") || l.includes("happy")) {
    return {
      from: "#F1C40F",
      to: "#F39C12",
      shadow: "rgba(241, 196, 15, 0.3)",
      icon: "😊",
    };
  }
  // Default neutral
  return {
    from: "#7F8C8D",
    to: "#95A5A6",
    shadow: "rgba(127, 140, 141, 0.3)",
    icon: "ℹ️",
  };
}

// Sınıfın baskın duygusunu hesaplayıp tek bir popup göster
function maybeShowDominantClassPopup(latestByStudent, threshold) {
  try {
    const counts = {
      frustrated: 0,
      confused: 0,
      focused: 0,
      sleepy: 0,
      happy: 0,
      otherNeg: 0,
    };
    const frustratedSet = [
      "sıkılmış",
      "yılmış",
      "bored",
      "frustrated",
      "zorlanıyor",
    ];
    const confusedSet = ["kafası karışmış", "confused"];
    const focusedSet = ["odaklanmış", "focused", "odak"];
    const sleepySet = ["uykulu", "sleepy"];
    const happySet = ["mutlu", "happy"];
    const otherNeg = ["üzgün", "kızgın", "sad", "angry", "fear", "disgust"];

    for (const name of Object.keys(latestByStudent)) {
      const item = latestByStudent[name];
      const e = (item.emotions && item.emotions[0]) || {};
      const label = String(e.emotion || "").toLowerCase();
      const conf = e.confidence || 0;
      if (conf < threshold) continue;
      if (frustratedSet.some((n) => label.includes(n))) counts.frustrated++;
      else if (confusedSet.some((n) => label.includes(n))) counts.confused++;
      else if (focusedSet.some((n) => label.includes(n))) counts.focused++;
      else if (sleepySet.some((n) => label.includes(n))) counts.sleepy++;
      else if (happySet.some((n) => label.includes(n))) counts.happy++;
      else if (otherNeg.some((n) => label.includes(n))) counts.otherNeg++;
    }

    // En yüksek sayıya sahip kategoriyi bul
    const ordered = Object.entries(counts)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    if (ordered.length === 0) return;

    const [topCat] = ordered[0];
    const labelMap = {
      frustrated: "Sıkılmış/Zorlanıyor",
      confused: "Kafası Karışmış",
      focused: "Odaklanmış",
      sleepy: "Uykulu",
      happy: "Mutlu",
      otherNeg: "Dikkat",
    };
    const displayLabel = labelMap[topCat] || "Durum";

    showClassAlert(displayLabel, counts[topCat]);
  } catch (e) {}
}

function showClassAlert(label, count) {
  const colors = getAlertColors(label);
  const alert = document.createElement("div");
  alert.style.cssText = `
    position: fixed;
    bottom: 90px;
    right: 20px;
    background: linear-gradient(45deg, ${colors.from}, ${colors.to});
    color: white;
    padding: 14px 16px;
    border-radius: 12px;
    box-shadow: 0 10px 25px ${colors.shadow};
    z-index: 10000001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 360px;
    border: 1px solid rgba(0,0,0,0.06);
    animation: slideIn 0.4s ease;
  `;
  const icon = colors.icon;
  alert.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:20px;">${icon}</span>
      <div>
        <div style="font-weight:700;">Sınıf Durumu</div>
        <div style="font-size:12px;opacity:0.9;">${label} (${count})</div>
      </div>
    </div>`;
  document.body.appendChild(alert);
  clearTimeout(alert.__hideTimer);
  alert.__hideTimer = setTimeout(() => {
    try {
      alert.style.animation = "slideOut 0.4s ease";
      setTimeout(() => alert.remove(), 400);
    } catch {}
  }, 6000);
}

window.addEventListener("load", async () => {
  console.log("👨‍🏫 Öğretmen paneli başlatılıyor...");

  await loadSettings();
  await getBackendUrl();

  // Respect showTeacherPanel option
  const syncVals = await chrome.storage.sync.get(["showTeacherPanel"]);
  const shouldShow = syncVals.showTeacherPanel !== false; // default true

  // Sadece gerçek toplantı sayfalarında başlat (BBB: /html5client/, Meet: oda deseni, Zoom: wc/j/…)
  if (!isInMeetingPage()) {
    console.log(
      "⏸️ Toplantı sayfasında değil (rooms/landing). Panel başlatılmıyor."
    );

    // URL değişimlerini izle: toplantıya geçilince başlat
    let lastHref = location.href;
    setInterval(async () => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        if (isInMeetingPage()) {
          console.log(
            "✅ Toplantı sayfası algılandı, öğretmen paneli başlatılıyor..."
          );
          // Tüm platformlarda isim sorma modalını 1s geciktir
          await new Promise((r) => setTimeout(r, 1000));
          const teacherInfo = await initializeTeacher();
          if (teacherInfo && shouldShow) {
            createTeacherControlPanel();
            console.log("✅ Öğretmen paneli hazır!");
          }
        }
      }
    }, 1500);
    return;
  }

  // Tüm platformlarda isim sorma modalını 1s geciktir
  await new Promise((r) => setTimeout(r, 1000));
  const teacherInfo = await initializeTeacher();
  if (teacherInfo && shouldShow) {
    createTeacherControlPanel();
    console.log("✅ Öğretmen paneli hazır!");
  }
});

const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// Listen for settings updates from options page to apply threshold changes immediately
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (
      message &&
      message.action === "teacherSettingsUpdated" &&
      message.settings
    ) {
      // Update in-memory settings
      settings.emotionThreshold =
        typeof message.settings.emotionThreshold === "number"
          ? message.settings.emotionThreshold
          : settings.emotionThreshold;
      settings.alertsEnabled = message.settings.alertsEnabled !== false;

      // Re-run dashboard to evaluate alerts with new threshold
      if (typeof loadDashboardData === "function") {
        loadDashboardData();
      }

      sendResponse && sendResponse({ status: "applied" });
      return true;
    }
  } catch (e) {
    // no-op
  }
  return false;
});
