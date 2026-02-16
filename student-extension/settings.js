console.log("⚙️ Settings sayfası yüklendi");

document.addEventListener("DOMContentLoaded", function () {
  console.log("📋 Settings DOM hazır");

  // Load current settings
  chrome.storage.sync.get(
    ["serverUrl", "apiKey", "notificationsEnabled"],
    function (result) {
      console.log("💾 Mevcut ayarlar yüklendi:", result);

      document.getElementById("server-url").value =
        result.serverUrl || "https://localhost:5001";
      document.getElementById("api-key").value =
        result.apiKey || "student_secret_key_2025";
      document.getElementById("notifications-enabled").checked =
        result.notificationsEnabled !== false;
    }
  );

  // Test connection with better error handling
  document.getElementById("test-connection").onclick = async function () {
    const serverUrl = document.getElementById("server-url").value.trim();
    const apiKey = document.getElementById("api-key").value.trim();
    const statusDiv = document.getElementById("connection-status");

    console.log("🔗 Bağlantı test ediliyor:", serverUrl);

    if (!serverUrl) {
      statusDiv.innerHTML =
        '<span class="error">❌ Sunucu adresi gerekli</span>';
      return;
    }

    if (!apiKey) {
      statusDiv.innerHTML =
        '<span class="error">❌ API anahtarı gerekli</span>';
      return;
    }

    // URL validation
    try {
      new URL(serverUrl);
    } catch (e) {
      statusDiv.innerHTML =
        '<span class="error">❌ Geçersiz URL formatı</span>';
      return;
    }

    statusDiv.innerHTML =
      '<span class="info">⏳ Bağlantı test ediliyor...</span>';

    try {
      // Background service worker proxy kullan
      chrome.runtime.sendMessage(
        {
          action: "HEALTH_CHECK",
          baseUrl: serverUrl,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "❌ Background proxy hatası:",
              chrome.runtime.lastError
            );
            statusDiv.innerHTML = `<span class="error">❌ Extension proxy hatası</span>`;
            return;
          }

          if (response && response.success) {
            console.log("✅ Server response:", response.data);
            statusDiv.innerHTML = `<span class="success">✅ Bağlantı başarılı! ${
              response.data.message || response.data.status || "Server aktif"
            }</span>`;
          } else {
            console.warn("⚠️ Server proxy error:", response);
            statusDiv.innerHTML = `<span class="error">❌ Server hatası: ${
              response.error || "Bilinmeyen hata"
            }</span>`;
          }
        }
      );
    } catch (error) {
      console.error("❌ Chrome runtime hatası:", error);
      statusDiv.innerHTML = `<span class="error">❌ Extension hatası</span>`;
    }
  };

  // Save settings with validation
  document.getElementById("save-settings").onclick = function () {
    console.log("💾 Ayarlar kaydediliyor...");

    const settings = {
      serverUrl: document.getElementById("server-url").value.trim(),
      apiKey: document.getElementById("api-key").value.trim(),
      notificationsEnabled: document.getElementById("notifications-enabled")
        .checked,
    };

    // Validate URL
    if (!settings.serverUrl) {
      alert("❌ Sunucu adresi gerekli");
      return;
    }

    if (!settings.apiKey) {
      alert("❌ API anahtarı gerekli");
      return;
    }

    try {
      new URL(settings.serverUrl);
    } catch (e) {
      alert("❌ Geçersiz URL formatı. Örnek: https://your-server.railway.app");
      return;
    }

    // Öğrenci analiz aralığı öğretmen tarafından yönetilir; doğrulama kaldırıldı

    chrome.storage.sync.set(settings, function () {
      if (chrome.runtime.lastError) {
        console.error("Storage error:", chrome.runtime.lastError);
        alert("❌ Ayarlar kaydedilemedi: " + chrome.runtime.lastError.message);
        return;
      }

      console.log("✅ Ayarlar kaydedildi:", settings);

      // Visual feedback
      const saveBtn = document.getElementById("save-settings");
      const originalText = saveBtn.textContent;
      saveBtn.textContent = "✅ Kaydedildi!";
      saveBtn.style.background = "#2ecc71";

      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = "";
      }, 2000);

      // Notify background script
      try {
        chrome.runtime.sendMessage(
          {
            type: "SETTINGS_UPDATED",
            settings: settings,
          },
          function (response) {
            if (chrome.runtime.lastError) {
              console.warn(
                "Background message error:",
                chrome.runtime.lastError
              );
            } else {
              console.log("📡 Background script bilgilendirildi:", response);
            }
          }
        );
      } catch (e) {
        console.warn("Message send error:", e);
      }
    });
  };

  // Reset settings
  document.getElementById("reset-settings").onclick = function () {
    if (
      confirm("Tüm ayarlar varsayılan değerlere sıfırlanacak. Emin misiniz?")
    ) {
      console.log("🔄 Ayarlar sıfırlanıyor...");

      chrome.storage.sync.clear(function () {
        if (chrome.runtime.lastError) {
          console.error("Clear error:", chrome.runtime.lastError);
          alert("❌ Ayarlar sıfırlanamadı");
          return;
        }

        console.log("✅ Ayarlar sıfırlandı");
        location.reload();
      });
    }
  };

  console.log("⚙️ Settings handlers hazır");
});
