const defaultSettings = {
  analysisInterval: 3000,
  emotionThreshold: 0.7,
  alertsEnabled: true,
  dataCollection: true,
  serverUrl: "http://127.0.0.1:5001",
  teacherApiKey: "",
  maxStudents: 200,
  showTeacherPanel: true,
  autoExport: false,
  dataRetention: 7,
  debugMode: false,
};

let backendStatus = {
  connected: false,
  modelLoaded: false,
  serverUrl: "http://127.0.0.1:5001",
  lastCheck: null,
  error: null,
};

document.addEventListener("DOMContentLoaded", function () {
  loadSettings();
  setupEventListeners();
  checkBackendStatus();

  setInterval(checkBackendStatus, 30000);
});

function loadSettings() {
  chrome.storage.sync.get(defaultSettings, function (settings) {
    document.getElementById("analysisInterval").value =
      settings.analysisInterval;
    document.getElementById("emotionThreshold").value =
      settings.emotionThreshold;
    document.getElementById("alertsEnabled").checked = settings.alertsEnabled;
    document.getElementById("dataCollection").checked = settings.dataCollection;
    document.getElementById("serverUrl").value = settings.serverUrl;
    document.getElementById("teacherApiKey").value = settings.teacherApiKey;
    document.getElementById("maxStudents").value = settings.maxStudents;
    document.getElementById("showTeacherPanel").checked =
      settings.showTeacherPanel;
    document.getElementById("autoExport").checked = settings.autoExport;
    document.getElementById("dataRetention").value = settings.dataRetention;
    document.getElementById("debugMode").checked = settings.debugMode;

    backendStatus.serverUrl = settings.serverUrl;
    updateThresholdDisplay(settings.emotionThreshold);
  });
}

function setupEventListeners() {
  const thresholdSlider = document.getElementById("emotionThreshold");
  thresholdSlider.addEventListener("input", function () {
    updateThresholdDisplay(this.value);
  });

  document
    .getElementById("saveSettings")
    .addEventListener("click", saveSettings);
  document
    .getElementById("resetSettings")
    .addEventListener("click", resetSettings);
  document
    .getElementById("testBackend")
    .addEventListener("click", testBackendConnection);
}

function updateThresholdDisplay(value) {
  const percentage = Math.round(value * 100);
  document.getElementById(
    "thresholdValue"
  ).textContent = `${percentage}% Güven`;
}

async function saveSettings() {
  const settings = {
    analysisInterval: parseInt(
      document.getElementById("analysisInterval").value
    ),
    emotionThreshold: parseFloat(
      document.getElementById("emotionThreshold").value
    ),
    alertsEnabled: document.getElementById("alertsEnabled").checked,
    dataCollection: document.getElementById("dataCollection").checked,
    serverUrl: document.getElementById("serverUrl").value.trim(),
    teacherApiKey: document.getElementById("teacherApiKey").value.trim(),
    maxStudents: parseInt(document.getElementById("maxStudents").value),
    showTeacherPanel: document.getElementById("showTeacherPanel").checked,
    autoExport: document.getElementById("autoExport").checked,
    dataRetention: parseInt(document.getElementById("dataRetention").value),
    debugMode: document.getElementById("debugMode").checked,
    userRole: "teacher",
  };

  backendStatus.serverUrl = settings.serverUrl;

  chrome.storage.sync.set(settings, function () {
    showSaveStatus("🎯 Öğretmen ayarları başarıyla kaydedildi!", "success");

    chrome.tabs.query({}, function (tabs) {
      tabs.forEach((tab) => {
        chrome.tabs
          .sendMessage(tab.id, {
            action: "teacherSettingsUpdated",
            settings: settings,
          })
          .catch(() => {});
      });
    });
  });

  await sendSettingsToBackend(settings);
}

async function sendSettingsToBackend(settings) {
  try {
    if (!backendStatus.connected) {
      console.log(
        "⚠️ Backend bağlı değil, ayarlar extension tarafında saklandı"
      );
      return;
    }

    const response = await fetch(
      `${backendStatus.serverUrl}/teacher-settings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": settings.teacherApiKey || "",
        },
        body: JSON.stringify({
          role: "teacher",
          analysis_interval: settings.analysisInterval,
          emotion_threshold: settings.emotionThreshold,
          alerts_enabled: settings.alertsEnabled,
          debug_mode: settings.debugMode,
          max_students: settings.maxStudents,
        }),
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Öğretmen ayarları backend güncellendi:", result);
      showSaveStatus("Ayarlar backend'e gönderildi! 🎯", "success");
    } else {
      console.warn("⚠️ Backend ayar gönderimi başarısız:", response.status);
      showSaveStatus(
        "Extension ayarları kaydedildi, backend güncellenemedi",
        "error"
      );
    }
  } catch (error) {
    console.error("❌ Backend ayar gönderimi hatası:", error);
    showSaveStatus(
      "Extension ayarları kaydedildi, backend erişilemedi",
      "error"
    );
  }
}

function resetSettings() {
  if (
    confirm(
      "🔄 Tüm öğretmen ayarlarını varsayılan değerlere sıfırlamak istediğinizden emin misiniz?"
    )
  ) {
    chrome.storage.sync.set(defaultSettings, function () {
      loadSettings();
      showSaveStatus("✅ Ayarlar varsayılan değerlere sıfırlandı!", "success");
    });
  }
}

async function testBackendConnection() {
  const button = document.getElementById("testBackend");
  button.disabled = true;
  button.textContent = "🔄 Test ediliyor...";

  try {
    await checkBackendStatus();
    if (backendStatus.connected) {
      showSaveStatus(
        "✅ Backend bağlantısı başarılı! AI modeli hazır.",
        "success"
      );
    } else {
      showSaveStatus(
        "❌ Backend bağlantısı başarısız: " + backendStatus.error,
        "error"
      );
    }
  } catch (error) {
    showSaveStatus("❌ Bağlantı testi hatası: " + error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "🔍 Backend Bağlantısını Test Et";
  }
}

function showSaveStatus(message, type) {
  const statusDiv = document.getElementById("saveStatus");
  statusDiv.textContent = message;
  statusDiv.className = `save-status ${type}`;
  statusDiv.style.display = "block";

  setTimeout(() => {
    statusDiv.style.display = "none";
  }, 4000);
}

async function checkBackendStatus() {
  const backendDiv = document.getElementById("backendStatus");
  const backendText = document.getElementById("backendStatusText");
  const backendDetails = document.getElementById("backendDetails");

  backendStatus.lastCheck = new Date();

  try {
    const serverUrl = (
      document.getElementById("serverUrl").value.trim() ||
      backendStatus.serverUrl
    ).replace(/\/$/, "");

    // Use background proxy to avoid any CORS/SSL friction in options page
    const proxyRes = await new Promise((resolve) =>
      chrome.runtime.sendMessage(
        { action: "HEALTH_CHECK", baseUrl: serverUrl },
        (res) => resolve(res)
      )
    );

    if (proxyRes && proxyRes.success) {
      const serverInfo = proxyRes.data || {};
      backendStatus.connected = true;
      backendStatus.modelLoaded = serverInfo.model_loaded || false;
      backendStatus.error = null;
      backendStatus.serverUrl = serverUrl;

      backendText.textContent = "🟢 Bağlantı Başarılı";

      if (serverInfo.model_loaded) {
        backendDetails.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
            <div>
              <strong>📊 Server Durumu:</strong> Aktif<br>
              <strong>🧠 AI Model:</strong> Yüklü ve Hazır<br>
              <strong>📡 Adres:</strong> ${serverUrl}
            </div>
            <div>
              <strong>🎯 Model:</strong> ${
                serverInfo.model_name || "Duygu_Tanima.h5"
              }<br>
              <strong>⚙️ Framework:</strong> ${
                serverInfo.framework || "TensorFlow"
              }<br>
              <strong>🕒 Son Test:</strong> ${backendStatus.lastCheck.toLocaleTimeString(
                "tr-TR"
              )}
            </div>
          </div>
        `;
        backendDiv.className = "backend-status success";
      } else {
        backendDetails.innerHTML = `
          <strong>⚠️ Uyarı:</strong> Server aktif ama AI model yüklenmemiş<br>
          <strong>🔧 Sorun:</strong> Duygu_Tanima.h5 dosyası bulunamıyor<br>
          <strong>💡 Çözüm:</strong> Model dosyasını python_server_central.py yanına koyun<br>
          <strong>📡 Server:</strong> ${serverUrl} ✅
        `;
        backendDiv.className = "backend-status error";
      }
    } else {
      const msg = (proxyRes && proxyRes.error) || "Server yanıt vermiyor";
      throw new Error(msg);
    }
  } catch (error) {
    backendStatus.connected = false;
    backendStatus.modelLoaded = false;
    backendStatus.error = error.message;

    backendText.textContent = "🔴 Bağlantı Başarısız";
    backendDetails.innerHTML = `
      <div style="background: rgba(220, 53, 69, 0.1); padding: 15px; border-radius: 8px; margin-top: 10px;">
        <strong>❌ Hata:</strong> ${error.message}<br>
        <strong>🔧 Çözüm Adımları:</strong><br>
  1️⃣ Python server başlatın: <code style="background: #333; color: #fff; padding: 2px 6px; border-radius: 4px;">python python_server_central.py</code><br>
        2️⃣ Doğru IP adresini girin (öğrencilerle paylaşılacak)<br>
  3️⃣ Windows Firewall'da 5001 portunu açın<br>
        <strong>🕒 Son Test:</strong> ${backendStatus.lastCheck.toLocaleTimeString(
          "tr-TR"
        )}
      </div>
    `;
    backendDiv.className = "backend-status error";
  }
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "openTeacherSettings") {
    window.focus();
  }
});
