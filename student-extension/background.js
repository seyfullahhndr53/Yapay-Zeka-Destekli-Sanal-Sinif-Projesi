// Background Service Worker for Student Extension
// Handles all network requests to avoid CSP/CORS issues in content scripts

console.log("🎓 Student Extension Background Worker Started");

chrome.runtime.onInstalled.addListener((details) => {
  console.log("📦 Student Extension Installed:", details.reason);

  // Set default settings on first install
  if (details.reason === "install") {
    chrome.storage.sync.set(
      {
        serverUrl: "http://127.0.0.1:5001",
        apiKey: "student_secret_key_2025",
        analysisInterval: 3000,
        userRole: "student",
        analysisEnabled: true,
        studentName: "",
        silent: true,
      },
      () => {
        console.log("✅ Default student settings initialized");
      }
    );
  }
});

// Message listener for content script requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Unified action-based handling (preferred)
  if (message && message.action) {
    try {
      switch (message.action) {
        case "HEALTH_CHECK":
          proxyHealthCheck(message.baseUrl).then(sendResponse);
          return true;
        case "ANALYZE_EMOTION":
          // Forward image + identity to backend
          proxyAnalyzeEmotion(
            message.baseUrl,
            {
              image: message.imageData,
              studentName: message.studentName,
              userId: message.userId,
            },
            message.apiKey
          ).then(sendResponse);
          return true;
        case "SEND_REPORT":
          proxySendReport(
            message.baseUrl,
            message.reportData,
            message.apiKey
          ).then(sendResponse);
          return true;
        case "SEND_MANUAL_FEEDBACK":
          proxySendManualFeedback(
            message.baseUrl,
            message.feedbackData,
            message.apiKey
          ).then(sendResponse);
          return true;
        default:
          // Fallback to generic network handler if a raw URL is provided
          if (message.url) {
            handleNetworkRequest(message, sendResponse);
            return true;
          }
          sendResponse({
            success: false,
            error: "Unknown action",
            action: message.action,
          });
          return true;
      }
    } catch (err) {
      console.error("Student BG: action handler error", err);
      sendResponse({
        success: false,
        error: err.message,
        action: message.action,
      });
      return true;
    }
  }

  // Backward compatibility: type-based handling
  if (message && message.type === "HEALTH_CHECK") {
    proxyHealthCheck(message.baseUrl).then(sendResponse);
    return true;
  }
  if (message && message.type === "ANALYZE_EMOTION") {
    proxyAnalyzeEmotion(
      message.baseUrl,
      message.imageData,
      message.apiKey
    ).then(sendResponse);
    return true;
  }
  if (message && message.type === "SEND_REPORT") {
    proxySendReport(message.baseUrl, message.reportData, message.apiKey).then(
      sendResponse
    );
    return true;
  }

  try {
    // Legacy message handling for backward compatibility
    if (!message || typeof message !== "object") {
      console.warn("⚠️ Invalid message format");
      sendResponse({ status: "error", message: "Invalid format" });
      return true;
    }

    if (message.type === "EMOTION_ANALYSIS_RESULT") {
      if (!message.data || !message.data.studentName) {
        console.warn("⚠️ Invalid emotion data");
        sendResponse({ status: "error", message: "Invalid data" });
        return true;
      }

      console.log(
        "📊 Duygu analizi sonucu:",
        message.data.emotions?.[0]?.emotion
      );

      chrome.storage.local.get(["analysisHistory"], (result) => {
        try {
          const history = Array.isArray(result.analysisHistory)
            ? result.analysisHistory
            : [];

          const analysisEntry = {
            ...message.data,
            timestamp: Date.now(),
            processed: true,
          };

          history.push(analysisEntry);

          // Memory management - keep last 150 entries
          if (history.length > 150) {
            history.splice(0, 50);
          }

          chrome.storage.local.set({ analysisHistory: history }, () => {
            if (chrome.runtime.lastError) {
              console.error("Storage error:", chrome.runtime.lastError);
            }
          });
        } catch (error) {
          console.error("❌ History storage error:", error);
        }
      });

      sendResponse({ status: "received", timestamp: Date.now() });
    } else if (message.type === "STUDENT_READY") {
      if (!message.studentName || typeof message.studentName !== "string") {
        console.warn("⚠️ Invalid student name");
        sendResponse({ status: "error", message: "Invalid student name" });
        return true;
      }

      console.log("👤 Öğrenci hazır:", message.studentName);

      // Student ready durumunu kaydet
      chrome.storage.local.set({
        studentStatus: "ready",
        lastActivity: Date.now(),
      });

      sendResponse({ status: "acknowledged", timestamp: Date.now() });
    } else if (message.type === "SETTINGS_UPDATED") {
      console.log("⚙️ Settings updated in background:", message.settings);

      // Store settings update timestamp
      chrome.storage.local.set({
        settingsUpdated: Date.now(),
        lastSettings: message.settings,
      });

      // Notify all content scripts about settings change
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (
            tab.url &&
            (tab.url.includes("meet.google.com") ||
              tab.url.includes("bigbluebutton") ||
              tab.url.includes("zoom.us"))
          ) {
            chrome.tabs.sendMessage(
              tab.id,
              {
                type: "SETTINGS_UPDATED",
                settings: message.settings,
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.log("Content script not ready in tab:", tab.id);
                }
              }
            );
          }
        });
      });

      sendResponse({ status: "settings_propagated", timestamp: Date.now() });
    } else if (message.type === "HEALTH_CHECK") {
      sendResponse({
        status: "healthy",
        version: "2.1.0",
        timestamp: Date.now(),
      });
    } else {
      console.warn("⚠️ Unknown message type:", message.type);
      sendResponse({ status: "unknown_type" });
    }
  } catch (error) {
    console.error("❌ Background message handling error:", error);
    sendResponse({ status: "error", message: error.message });
  }

  return true; // Async response için
});

// Network request handler with proper error handling
async function handleNetworkRequest(message, sendResponse) {
  try {
    const {
      action,
      url,
      method = "GET",
      body,
      headers = {},
      timeout = 8000,
    } = message;

    // Add API key header if available
    if (message.apiKey) {
      headers["X-API-KEY"] = message.apiKey;
    }

    // Add Content-Type for POST requests
    if (method === "POST" && body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    console.log(`🌐 Background fetch: ${method} ${url}`);

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json();

      sendResponse({
        success: true,
        status: response.status,
        data: responseData,
        action: action,
      });

      console.log(`✅ Background fetch success: ${response.status}`);
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Categorize error types with better diagnostics
      let errorType = "network";
      let errorMessage = fetchError.message || "Failed to fetch";

      if (fetchError.name === "AbortError") {
        errorType = "timeout";
        errorMessage = `Request timeout after ${timeout}ms`;
      } else if (errorMessage.includes("net::ERR_CERT_")) {
        errorType = "ssl";
        errorMessage = "SSL certificate error - accept certificate in browser";
      } else if (
        errorMessage.includes("CORS") ||
        errorMessage.includes("cross-origin")
      ) {
        errorType = "cors";
        errorMessage = "Cross-origin request blocked";
      }

      // Heuristic: https localhost with self-signed cert often reports generic message
      if (
        errorType === "network" &&
        typeof url === "string" &&
        url.startsWith("https://") &&
        (url.includes("localhost") || url.includes("127.0.0.1"))
      ) {
        errorType = "ssl";
        errorMessage =
          "SSL certificate error or blocked HTTPS (try http://127.0.0.1:5001 or accept cert)";
      }

      console.error(
        `❌ Background fetch error [${errorType}] ${method} ${url}:`,
        errorMessage
      );

      sendResponse({
        success: false,
        error: `${errorMessage}`,
        errorType: errorType,
        action: action,
        url: url,
        method: method,
      });
    }
  } catch (error) {
    console.error("❌ Background request handler error:", error);
    sendResponse({
      success: false,
      error: error.message,
      errorType: "handler",
      action: message.action,
    });
  }
}

// Extension startup handler
chrome.runtime.onStartup.addListener(() => {
  console.log("🔄 Student Extension Background Worker Restarted");
});

// ==================== PROXY FUNCTIONS ====================

/**
 * Kategorilere göre error tipleri belirler
 */
function categorizeError(error, response) {
  const errorMessage = error?.message?.toLowerCase() || "";

  if (errorMessage.includes("ssl") || errorMessage.includes("certificate")) {
    return "ssl";
  }
  if (errorMessage.includes("cors") || errorMessage.includes("cross-origin")) {
    return "cors";
  }
  if (errorMessage.includes("timeout") || errorMessage.includes("aborted")) {
    return "timeout";
  }
  if (!response) {
    return "network";
  }
  if (response.status >= 500) {
    return "server";
  }
  if (response.status >= 400) {
    return "client";
  }
  return "unknown";
}

/**
 * Generic proxy function for API calls
 */
async function proxyRequest(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 saniye timeout

  try {
    console.log(`🌐 Background: Fetch request to ${url}`);
    console.log(`   Method: ${options.method || "GET"}`);
    console.log(`   Headers:`, options.headers);
    console.log(
      `   Body:`,
      options.body ? options.body.substring(0, 200) : "none"
    );

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    console.log(
      `📡 Background: Response status ${response.status} ${response.statusText}`
    );

    if (!response.ok) {
      // HTTP hata durumunda backend'den gelen detaylı mesajı al
      let errorDetails = response.statusText;
      try {
        const errorBody = await response.json();
        console.error(`❌ Backend error response:`, errorBody);
        errorDetails =
          errorBody.error || errorBody.message || response.statusText;

        // Tam detaylı yanıt döndür
        return {
          success: false,
          error: errorDetails,
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
          errorType: "http_error",
          timestamp: Date.now(),
        };
      } catch (parseError) {
        console.error(`❌ Error body parse hatası:`, parseError);
      }

      throw new Error(`HTTP ${response.status}: ${errorDetails}`);
    }

    const data = await response.json();
    console.log(`✅ Background: Success response`, data);
    return { success: true, data };
  } catch (error) {
    clearTimeout(timeoutId);
    const errorType = categorizeError(error);

    console.error(`❌ Background: Fetch error`, error);

    return {
      success: false,
      error: error.message,
      errorType,
      timestamp: Date.now(),
    };
  }
}

/**
 * Health check proxy
 */
async function proxyHealthCheck(baseUrl) {
  console.log("🔍 Background: Health check proxy for", baseUrl);
  return await proxyRequest(`${baseUrl}/health`);
}

/**
 * Emotion analysis proxy
 */
async function proxyAnalyzeEmotion(baseUrl, payload, apiKey) {
  console.log("🎭 Background: Emotion analysis proxy");
  return await proxyRequest(`${baseUrl}/analyze`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });
}

/**
 * Report sending proxy
 */
async function proxySendReport(baseUrl, reportData, apiKey) {
  console.log("📊 Background: Report sending proxy");
  return await proxyRequest(`${baseUrl}/student-report`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(reportData),
  });
}

/**
 * Manuel feedback sending proxy
 */
async function proxySendManualFeedback(baseUrl, feedbackData, apiKey) {
  console.log("📝 Background: Manuel feedback proxy başlatılıyor");
  console.log("   Base URL:", baseUrl);
  console.log("   API Key:", apiKey ? `${apiKey.substring(0, 10)}...` : "YOK");
  console.log("   Feedback Data:", feedbackData);
  console.log(
    "   Feedback Data keys:",
    feedbackData ? Object.keys(feedbackData) : "NULL"
  );
  console.log("   JSON stringified:", JSON.stringify(feedbackData));

  const result = await proxyRequest(`${baseUrl}/manual-feedback`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(feedbackData),
  });

  console.log("📝 Background: Manuel feedback proxy sonucu:", result);
  return result;
}

// Background cleanup - her 5 dakikada eski verileri temizle
setInterval(() => {
  chrome.storage.local.get(["analysisHistory", "studentStatus"], (result) => {
    try {
      let needsUpdate = false;
      const updates = {};

      // Eski analiz verilerini temizle (2 saatten eski)
      if (result.analysisHistory) {
        const cutoff = Date.now() - 2 * 60 * 60 * 1000; // 2 saat
        const filtered = result.analysisHistory.filter(
          (entry) => entry.timestamp && entry.timestamp > cutoff
        );

        if (filtered.length !== result.analysisHistory.length) {
          updates.analysisHistory = filtered;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        chrome.storage.local.set(updates);
        console.log("🧹 Eski veriler temizlendi");
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });
}, 5 * 60 * 1000); // 5 dakika
