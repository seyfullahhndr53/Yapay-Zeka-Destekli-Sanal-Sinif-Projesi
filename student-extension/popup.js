document.addEventListener("DOMContentLoaded", function () {
  const studentInfo = document.getElementById("studentInfo");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const statusDetail = document.getElementById("statusDetail");
  const analysisCount = document.getElementById("analysisCount");
  const sessionTime = document.getElementById("sessionTime");
  const toggleBtn = document.getElementById("toggleAnalysis");
  const serverBtn = document.getElementById("serverSettingsBtn");

  let sessionStart = null;
  let timerInterval = null;
  let isAnalysisActive = false;

  function loadStudentInfo() {
    chrome.storage.local.get(["studentName", "userId"], function (result) {
      if (result.studentName && result.userId) {
        studentInfo.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-weight: 600; font-size: 14px;">${
                result.studentName
              }</div>
              <div style="font-size: 11px; opacity: 0.8;">ID: ${result.userId.substring(
                0,
                15
              )}...</div>
            </div>
            <div style="background: rgba(46, 204, 113, 0.2); color: #2ecc71; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
              👤 Kayıtlı
            </div>
          </div>
        `;
      } else {
        studentInfo.innerHTML = `
          <div class="loading">⚠️ Henüz kayıt yapılmamış</div>
        `;
      }
    });
  }

  function updateStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentTab = tabs && tabs[0];
      const url = (currentTab && currentTab.url) || "";

      const safeIncludes = (str, needle) => {
        try {
          return (str || "").includes(needle);
        } catch {
          return false;
        }
      };

      const isVideoConference =
        safeIncludes(url, "bigbluebutton") ||
        safeIncludes(url, "/b/") ||
        safeIncludes(url, "meet.google.com") ||
        safeIncludes(url, "zoom.us");

      if (isVideoConference) {
        statusDot.className = "status-dot";
        statusText.textContent = "Video Konferansta";
        try {
          statusDetail.textContent = `Bağlı: ${new URL(url).hostname}`;
        } catch {
          statusDetail.textContent = `Bağlı`;
        }

        if (currentTab && currentTab.id) {
          chrome.tabs.sendMessage(
            currentTab.id,
            { action: "checkAnalysisStatus" },
            function (response) {
              if (chrome.runtime.lastError) {
                statusText.textContent = "Sayfa Yenilenmeli";
                statusDetail.textContent =
                  "Sayfayı yenileyin ve tekrar deneyin";
                statusDot.className = "status-dot inactive";
              } else if (response && response.active) {
                statusText.textContent = "Analiz Aktif";
                statusDetail.textContent = "Duygu analizi çalışıyor";
                isAnalysisActive = true;
                updateToggleButton();
                startSessionTimer();

                // Server bağlantı durumunu kontrol et
                checkServerConnection();
              }
            }
          );
        } else {
          statusText.textContent = "Sekme bulunamadı";
          statusDetail.textContent = "Aktif sekme yok";
          statusDot.className = "status-dot inactive";
        }
      } else {
        statusDot.className = "status-dot inactive";
        statusText.textContent = "Video Konferans Gerekli";
        statusDetail.textContent = "BBB, Google Meet veya Zoom'a gidin";
        isAnalysisActive = false;
        updateToggleButton();
        stopSessionTimer();
      }
    });
  }

  function updateAnalysisCount() {
    chrome.storage.local.get(["analysisHistory"], function (result) {
      const history = result.analysisHistory || [];
      const todayCount = history.filter((entry) => {
        const entryDate = new Date(entry.timestamp);
        const today = new Date();
        return entryDate.toDateString() === today.toDateString();
      }).length;

      analysisCount.textContent = todayCount;
    });
  }

  function startSessionTimer() {
    if (!sessionStart) {
      // Use persisted start if exists
      chrome.storage.local.get(["analysisSessionStart"], (res) => {
        sessionStart = res.analysisSessionStart || Date.now();
      });
    }

    if (!timerInterval) {
      timerInterval = setInterval(updateSessionTime, 1000);
    }
  }

  function stopSessionTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    sessionStart = null;
    sessionTime.textContent = "00:00";
  }

  function updateSessionTime() {
    if (!sessionStart) return;

    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    sessionTime.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  function updateToggleButton() {
    if (isAnalysisActive) {
      toggleBtn.textContent = "⏹️ Analizi Durdur";
      toggleBtn.className = "btn";
    } else {
      toggleBtn.textContent = "🎯 Analizi Başlat";
      toggleBtn.className = "btn primary";
    }
  }

  function checkServerConnection() {
    chrome.storage.sync.get(["serverUrl", "studentApiKey"], function (result) {
      const serverUrl = result.serverUrl || "http://127.0.0.1:5001";
      const apiKey = result.studentApiKey || "";

      // Background service worker proxy kullan
      chrome.runtime.sendMessage(
        {
          action: "HEALTH_CHECK",
          baseUrl: serverUrl,
          apiKey: apiKey,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "❌ Background proxy hatası:",
              chrome.runtime.lastError
            );
            statusDetail.textContent = "Extension proxy hatası";
            return;
          }

          if (response && response.success) {
            statusDetail.textContent =
              "Duygu analizi çalışıyor - Bağlantı sağlıklı";
          } else {
            statusDetail.textContent = "Server yanıt vermiyor";
            console.warn("Server connection check failed:", response?.error);
          }
        }
      );
    });
  }

  toggleBtn.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const message = isAnalysisActive
        ? { action: "stopAnalysis" }
        : { action: "startAnalysis" };

      const tabId = tabs && tabs[0] && tabs[0].id;
      if (!tabId) {
        statusText.textContent = "Sekme bulunamadı";
        statusDetail.textContent = "Aktif sekme yok";
        return;
      }

      chrome.tabs.sendMessage(tabId, message, function (response) {
        if (chrome.runtime.lastError) {
          console.error("Message sending failed:", chrome.runtime.lastError);
          statusText.textContent = "Sayfa Yenilenmeli";
          statusDetail.textContent = "Lütfen sayfayı yenileyin";
          return;
        }

        // Trust content script response for actual state
        if (response && response.success) {
          isAnalysisActive = message.action === "startAnalysis";
          updateToggleButton();
          if (isAnalysisActive) {
            startSessionTimer();
            checkServerConnection();
          } else {
            stopSessionTimer();
          }
        } else {
          // Re-query current status to avoid desync
          chrome.tabs.sendMessage(
            tabId,
            { action: "checkAnalysisStatus" },
            function (res2) {
              if (res2 && res2.active) {
                isAnalysisActive = true;
                startSessionTimer();
              } else {
                isAnalysisActive = false;
                stopSessionTimer();
              }
              updateToggleButton();
            }
          );
        }
      });
    });
  });

  // Settings button - open settings page
  if (document.getElementById("settingsBtn")) {
    document
      .getElementById("settingsBtn")
      .addEventListener("click", function () {
        chrome.tabs.create({ url: "settings.html" });
      });
  }

  // Keep old server button for backward compatibility
  serverBtn.addEventListener("click", function () {
    chrome.tabs.create({ url: "settings.html" });
  });

  loadStudentInfo();
  updateStatus();
  updateAnalysisCount();

  // When popup opens, initialize timer from persisted start if analysis is active
  chrome.storage.local.get(["analysisSessionStart"], (res) => {
    if (res.analysisSessionStart) {
      sessionStart = res.analysisSessionStart;
      startSessionTimer();
    }
  });

  setInterval(updateStatus, 3000);
  setInterval(updateAnalysisCount, 5000);
});
