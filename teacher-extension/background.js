// Background Service Worker for Teacher Extension
// Handles network requests and student data collection

console.log("🎭 Teacher Extension Background Worker Started");

chrome.runtime.onInstalled.addListener((details) => {
  console.log("🔧 Teacher Extension Installed:", details.reason);

  // Set default settings on first install
  if (details.reason === "install") {
    chrome.storage.sync.set(
      {
        userRole: "teacher",
        backendUrl: "http://127.0.0.1:5001",
        teacherApiKey: "teacher_admin_key_2025",
        analysisInterval: 3000,
        emotionThreshold: 0.7,
        alertsEnabled: true,
        dataCollection: true,
      },
      () => {
        console.log("✅ Default teacher settings initialized");
      }
    );
  }
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
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    clearTimeout(timeoutId);
    const errorType = categorizeError(error);

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
  console.log("🔍 Teacher Background: Health check proxy for", baseUrl);
  return await proxyRequest(`${baseUrl}/health`);
}

/**
 * Get students list proxy
 */
async function proxyGetStudents(baseUrl, apiKey) {
  console.log("👥 Teacher Background: Get students proxy");
  return await proxyRequest(`${baseUrl}/get-students`, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
    },
  });
}

/**
 * Send alert proxy
 */
async function proxySendAlert(baseUrl, alertData, apiKey) {
  console.log("🚨 Teacher Background: Send alert proxy");
  return await proxyRequest(`${baseUrl}/send-alert`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(alertData),
  });
}

/**
 * Get analytics proxy
 */
async function proxyGetAnalytics(baseUrl, apiKey) {
  console.log("📈 Teacher Background: Get analytics proxy");
  return await proxyRequest(`${baseUrl}/get-analytics`, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
    },
  });
}

/**
 * Get teacher dashboard (active students, recent emotions)
 */
async function proxyGetDashboard(baseUrl, apiKey) {
  console.log("🗂️ Teacher Background: Get dashboard proxy");
  return await proxyRequest(`${baseUrl}/teacher-dashboard`, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
    },
  });
}

// Extension startup handler
chrome.runtime.onStartup.addListener(() => {
  console.log("🔄 Teacher Extension Background Worker Restarted");
});

// Background cleanup - her 10 dakikada eski verileri temizle
setInterval(() => {
  chrome.storage.local.get(["emotionHistory", "studentData"], (result) => {
    try {
      let needsUpdate = false;
      const updates = {};

      // Eski emotion history verilerini temizle (4 saatten eski)
      if (result.emotionHistory) {
        const cutoff = Date.now() - 4 * 60 * 60 * 1000; // 4 saat
        const filtered = result.emotionHistory.filter(
          (entry) => entry.timestamp && entry.timestamp > cutoff
        );
        if (filtered.length !== result.emotionHistory.length) {
          updates.emotionHistory = filtered;
          needsUpdate = true;
        }
      }

      // Eski student data temizle (2 saatten eski)
      if (result.studentData) {
        const cutoff = Date.now() - 2 * 60 * 60 * 1000; // 2 saat
        const filtered = result.studentData.filter(
          (entry) => entry.lastSeen && entry.lastSeen > cutoff
        );
        if (filtered.length !== result.studentData.length) {
          updates.studentData = filtered;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        chrome.storage.local.set(updates);
        console.log("🧹 Teacher Background: Cleaned old data");
      }
    } catch (error) {
      console.error("❌ Teacher Background: Cleanup error", error);
    }
  });
}, 10 * 60 * 1000); // 10 dakika

// ==================== MESSAGE HANDLING ====================

// Message listener for popup/content script requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 Teacher Background: Received message", message.action);

  try {
    switch (message.action) {
      case "HEALTH_CHECK":
        proxyHealthCheck(message.baseUrl).then(sendResponse);
        break;
      case "GET_STUDENTS":
        proxyGetStudents(message.baseUrl, message.apiKey).then(sendResponse);
        break;
      case "SEND_ALERT":
        proxySendAlert(message.baseUrl, message.alertData, message.apiKey).then(
          sendResponse
        );
        break;
      case "GET_ANALYTICS":
        proxyGetAnalytics(message.baseUrl, message.apiKey).then(sendResponse);
        break;
      case "GET_DASHBOARD":
        proxyGetDashboard(message.baseUrl, message.apiKey).then(sendResponse);
        break;
      case "NETWORK_REQUEST":
        // Generic network proxy (GET/POST etc.)
        handleNetworkRequest(message, sendResponse);
        break;
      default:
        sendResponse({
          success: false,
          error: "Unknown action: " + message.action,
          errorType: "handler",
        });
    }
  } catch (error) {
    console.error("❌ Teacher Background: Message handler error", error);
    sendResponse({
      success: false,
      error: error.message,
      errorType: "handler",
      action: message.action,
    });
  }

  return true; // Keep channel open for async response
});

// Legacy student emotion data handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "STUDENT_EMOTION_DATA") {
    console.log("📊 Öğrenci duygusal veri alındı:", message.data);

    chrome.storage.local.get(["emotionHistory"], (result) => {
      const history = result.emotionHistory || [];
      history.push({
        ...message.data,
        timestamp: Date.now(),
        tabId: sender.tab?.id,
      });

      chrome.storage.local.set({ emotionHistory: history });
    });

    sendResponse({ status: "received" });
  }

  return true;
});

// Network request handler (same as student extension)
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

    // Add teacher API key header if available
    if (message.teacherApiKey) {
      headers["X-API-KEY"] = message.teacherApiKey;
    }

    // Add Content-Type for POST requests
    if (method === "POST" && body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    console.log(`🌐 Teacher background fetch: ${method} ${url}`);

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

      console.log(`✅ Teacher background fetch success: ${response.status}`);
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Categorize error types
      let errorType = "network";
      let errorMessage = fetchError.message;

      if (fetchError.name === "AbortError") {
        errorType = "timeout";
        errorMessage = `Request timeout after ${timeout}ms`;
      } else if (errorMessage.includes("net::ERR_CERT_")) {
        errorType = "ssl";
        errorMessage = "SSL certificate error - accept certificate in browser";
      } else if (errorMessage.includes("CORS")) {
        errorType = "cors";
        errorMessage = "Cross-origin request blocked";
      }

      console.error(
        `❌ Teacher background fetch error [${errorType}]:`,
        errorMessage
      );

      sendResponse({
        success: false,
        error: errorMessage,
        errorType: errorType,
        action: action,
      });
    }
  } catch (error) {
    console.error("❌ Teacher background request handler error:", error);
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
  console.log("🔄 Teacher Extension Background Worker Restarted");
});

// Keep service worker active
setInterval(() => {
  // Heartbeat to prevent service worker from sleeping
}, 20000);
