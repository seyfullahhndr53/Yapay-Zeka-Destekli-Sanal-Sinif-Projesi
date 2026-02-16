console.log("🎓 Multi-Platform Student Extension - Emotion Analysis Active");

// ==================== PLATFORM DETECTION & URL GUARDS ====================

/**
 * Enhanced platform detection with multiple indicators
 */
function getCurrentPlatform() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  const href = window.location.href;

  // Google Meet detection - multiple patterns
  if (hostname.includes("meet.google.com")) {
    return "meet";
  }

  // Zoom Web Client detection - comprehensive patterns
  if (
    hostname.includes("zoom.us") ||
    hostname.includes("zoom.com") ||
    href.includes("/wc/") ||
    href.includes("/j/") ||
    href.includes("/meeting/") ||
    pathname.includes("webinar")
  ) {
    return "zoom";
  }

  // BigBlueButton detection - multiple indicators
  if (
    pathname.includes("/html5client/") ||
    pathname.includes("/bigbluebutton/") ||
    hostname.includes("bigbluebutton") ||
    hostname.includes("bbb") ||
    // DOM-based detection for dynamic BBB instances
    document.querySelector('div[data-test="joinAudio"]') ||
    document.querySelector('div[class*="bigbluebutton"]') ||
    document.querySelector('div[class*="ReactModal"]') ||
    document.querySelector('button[aria-label*="microphone"]')
  ) {
    return "bbb";
  }

  return "none";
}

/**
 * Enhanced meeting page validation with URL guards
 */
function isInMeetingPage() {
  const currentUrl = window.location.href;
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  const platform = getCurrentPlatform();

  // URL whitelist patterns per platform
  const urlPatterns = {
    meet: [
      /meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/,
      /meet\.google\.com\/[a-z0-9\-]{8,}(\/.*)?$/,
      /meet\.google\.com\/lookup\//,
      /meet\.google\.com\/room\//,
      /meet\.google\.com\/\w{3}-\w{4}-\w{3}$/,
    ],
    zoom: [
      /zoom\.us\/wc\//,
      /zoom\.us\/j\/\d{9,11}/,
      /zoom\.us\/meeting\//,
      /zoom\.com\/wc\//,
      /zoom\.com\/j\/\d{9,11}/,
      /\/\d{9,11}[?#]?/,
    ],
    bbb: [
      /\/html5client\/join\?/,
      /\/bigbluebutton\/api\/join\?/,
      /\/client\/BigBlueButton\.html/,
      /\/html5client\//,
      /sessionToken=/,
    ],
  };

  // Validate against platform-specific URL patterns
  if (platform !== "none" && urlPatterns[platform]) {
    return urlPatterns[platform].some((pattern) => pattern.test(currentUrl));
  }

  // Additional DOM-based validation for BBB
  if (platform === "bbb") {
    return (
      document.querySelector('div[data-test="connectionStatus"]') ||
      document.querySelector('div[class*="meeting"]') ||
      document.querySelector("video[autoplay]")
    );
  }

  return false;
}

/**
 * Security validation for trusted domains
 */
function isValidDomain() {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  // Protocol validation
  // Allow http in dev for localhost/127.0.0.1 and conference platforms (dev server is HTTP)
  if (protocol !== "https:" && !/^http:/.test(protocol)) {
    console.warn("⚠️ Unsupported protocol");
    return false;
  }

  // Trusted domain patterns
  const trustedDomains = [
    /^meet\.google\.com$/,
    /^[\w\-]+\.zoom\.us$/,
    /^[\w\-]+\.zoom\.com$/,
    /^[\w\-]+\.bigbluebutton\./,
    /^[\w\-]+\.bbb\./,
    /localhost/,
    /127\.0\.0\.1/,
  ];

  return trustedDomains.some((pattern) => pattern.test(hostname));
}

// Wait until BBB meeting UI is fully loaded
async function waitForBBBReady(maxWaitMs = 30000) {
  const start = Date.now();
  const readySelectors = [
    'div[data-test="connectionStatus"]',
    'div[class*="meeting"]',
    'div[data-test="userList"]',
    "video[autoplay]",
  ];

  return new Promise((resolve) => {
    // Quick check
    if (readySelectors.some((sel) => document.querySelector(sel))) {
      resolve(true);
      return;
    }

    const observer = new MutationObserver(() => {
      if (readySelectors.some((sel) => document.querySelector(sel))) {
        observer.disconnect();
        resolve(true);
      }
    });

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });

    const timer = setInterval(() => {
      if (Date.now() - start > maxWaitMs) {
        clearInterval(timer);
        observer.disconnect();
        resolve(false);
      }
    }, 500);
  });
}

// ==================== VIDEO SELECTORS ====================

/**
 * Platform-specific video selectors with fallbacks
 */
const videoSelectors = {
  meet: [
    'video[autoplay]:not([class*="preview"])',
    'video[class*="remote"]',
    'video[class*="participant"]',
    'video:not([class*="self"]):not([class*="preview"]):not([class*="presentation"])',
    "div[data-self-name] video",
    "div[jscontroller] video[autoplay]",
  ],
  zoom: [
    'video[autoplay]:not([class*="preview"])',
    'video[class*="video-player"]',
    'video[class*="participant-video"]',
    'div[class*="video-container"] video',
    'div[class*="participant-container"] video',
    'video:not([class*="self"]):not([class*="avatar"])',
  ],
  bbb: [
    "video[autoplay]",
    'video[class*="media"]',
    'video[data-test*="video"]',
    'div[class*="webcam"] video',
    'div[class*="video-container"] video',
    'div[class*="user-video"] video',
  ],
};

/**
 * Enhanced video detection with multiple strategies
 */
function findActiveVideoElement() {
  const platform = getCurrentPlatform();

  if (platform === "none") {
    console.warn("⚠️ Platform not supported");
    return null;
  }

  const selectors = videoSelectors[platform] || [];

  // Strategy 1: Platform-specific selectors
  for (const selector of selectors) {
    const videos = document.querySelectorAll(selector);
    for (const video of videos) {
      if (isVideoActive(video)) {
        console.log(`✅ Found active video via selector: ${selector}`);
        return video;
      }
    }
  }

  // Strategy 2: Generic video fallback
  const allVideos = document.querySelectorAll("video");
  for (const video of allVideos) {
    if (isVideoActive(video) && !isPreviewVideo(video)) {
      console.log("✅ Found active video via generic search");
      return video;
    }
  }

  // Strategy 3: Platform-specific DOM traversal
  return findVideoByPlatformStructure(platform);
}

/**
 * Video activity validation
 */
function isVideoActive(video) {
  if (!video || !video.videoWidth || !video.videoHeight) {
    return false;
  }

  // Check if video is playing and not paused
  if (video.paused || video.ended) {
    return false;
  }

  // Check if video has reasonable dimensions
  if (video.videoWidth < 160 || video.videoHeight < 120) {
    return false;
  }

  // Check if video is visible in viewport
  const rect = video.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return false;
  }

  return true;
}

/**
 * Preview video detection and exclusion
 */
function isPreviewVideo(video) {
  const element = video;
  const parent = element.parentElement;
  const classNames = (
    element.className +
    " " +
    (parent?.className || "")
  ).toLowerCase();

  // Common preview indicators
  const previewIndicators = [
    "preview",
    "self",
    "local",
    "own",
    "me",
    "camera-preview",
    "settings",
    "test",
    "setup",
    "avatar",
    "profile",
  ];

  return previewIndicators.some((indicator) => classNames.includes(indicator));
}

/**
 * Platform-specific DOM structure video finding
 */
function findVideoByPlatformStructure(platform) {
  switch (platform) {
    case "meet":
      // Look for participant containers in Meet
      const meetContainers = document.querySelectorAll("div[jscontroller]");
      for (const container of meetContainers) {
        const video = container.querySelector("video[autoplay]");
        if (video && isVideoActive(video) && !isPreviewVideo(video)) {
          return video;
        }
      }
      break;

    case "zoom":
      // Look for video containers in Zoom
      const zoomContainers = document.querySelectorAll(
        'div[class*="video"], div[class*="participant"]'
      );
      for (const container of zoomContainers) {
        const video = container.querySelector("video");
        if (video && isVideoActive(video) && !isPreviewVideo(video)) {
          return video;
        }
      }
      break;

    case "bbb":
      // Look for webcam containers in BBB
      const bbbContainers = document.querySelectorAll(
        'div[class*="webcam"], div[class*="video"], div[class*="media"]'
      );
      for (const container of bbbContainers) {
        const video = container.querySelector("video");
        if (video && isVideoActive(video)) {
          return video;
        }
      }
      break;
  }

  return null;
}

// ==================== INITIALIZATION & GUARDS ====================

/**
 * Extension initialization with security checks
 */
function initializeExtension() {
  // Security validation
  if (!isValidDomain()) {
    console.warn("⚠️ Extension blocked: Invalid domain");
    return false;
  }

  if (!isInMeetingPage()) {
    console.warn("⚠️ Extension blocked: Not in meeting page");
    return false;
  }

  const platform = getCurrentPlatform();
  console.log(`✅ Extension initialized for platform: ${platform}`);
  return true;
}

// YAZILIM GELİŞTİRİCİ İYİLEŞTİRMESİ: Enhanced State Management
class StudentAnalysisState {
  constructor() {
    this.studentName = null;
    this.userId = null;
    this.analysisActive = false;
    this.serverUrl = "http://127.0.0.1:5001"; // Default to HTTP for dev
    this.apiKey = "student_secret_key_2025"; // Default API key
    this.analysisInterval = 3000;
    this.lastAnalysis = 0;
    this.serverHealthy = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.settingsCheckInterval = null;
    this.analysisLoop = null;
    this.errorState = null;
    this.platform = getCurrentPlatform();
    this.retryBackoff = 1000; // Start with 1s backoff
    this.performanceMetrics = {
      successCount: 0,
      errorCount: 0,
      avgResponseTime: 0,
      lastResponseTimes: [],
    };
  }

  cleanup() {
    if (this.settingsCheckInterval) {
      clearInterval(this.settingsCheckInterval);
      this.settingsCheckInterval = null;
    }
    if (this.analysisLoop) {
      clearInterval(this.analysisLoop);
      this.analysisLoop = null;
    }
    // state reset handled by caller
  }

  recordSuccess(responseTime) {
    this.performanceMetrics.successCount++;
    this.performanceMetrics.lastResponseTimes.push(responseTime);
    if (this.performanceMetrics.lastResponseTimes.length > 20) {
      this.performanceMetrics.lastResponseTimes.shift();
    }
    this.performanceMetrics.avgResponseTime =
      this.performanceMetrics.lastResponseTimes.reduce((a, b) => a + b, 0) /
      this.performanceMetrics.lastResponseTimes.length;

    // Reset backoff on success
    this.retryBackoff = 1000;
    this.connectionRetries = 0;
  }

  recordError(error) {
    this.performanceMetrics.errorCount++;
    this.connectionRetries++;
    this.errorState = {
      error: error?.message || "Unknown error",
      timestamp: Date.now(),
    };

    // Exponential backoff with jitter
    this.retryBackoff = Math.min(
      this.retryBackoff * 1.5 + Math.random() * 1000,
      30000
    );
  }

  getHealthStatus() {
    const errorRate =
      this.performanceMetrics.errorCount /
      (this.performanceMetrics.successCount +
        this.performanceMetrics.errorCount);
    return {
      healthy: errorRate < 0.2 && this.serverHealthy,
      errorRate: errorRate,
      avgResponseTime: this.performanceMetrics.avgResponseTime,
      connectionRetries: this.connectionRetries,
      platform: this.platform,
    };
  }
}

// Platform-specific video element selection - ENHANCED 2025
function pickVideoElement(platform) {
  const selectors = {
    meet: [
      // 2025 Google Meet selectors - more robust
      'video[aria-label*="camera"]',
      "video[autoplay][playsinline]:not([muted])",
      'div[role="presentation"] video',
      'div[data-self-video="true"] video',
      'div[jscontroller] video[src^="blob:"]',
      "div[data-participant-id] video",
      ".NzPR9b video", // Grid view
      'video[data-participant-id]:not([data-participant-id=""])',
      'video:not([class*="background"]):not([class*="presentation"])',
    ],
    zoom: [
      // Enhanced Zoom Web Client selectors
      "video[data-participant-id]",
      'div[class*="video-participant"] video',
      'video[data-test*="video"]',
      ".participant-video video",
      "#live-video video",
      ".participants-video video",
      ".video-container video",
      'video[id*="video"]:not([id*="screen"])',
      'div[aria-label*="video"] video',
      "canvas + video", // Fallback to canvas
      "video[autoplay]:not([muted])",
    ],
    bbb: [
      // Improved BigBlueButton selectors for different versions
      'video[data-test="videoElement"]',
      ".video-content video",
      'div[class*="webcam"] video',
      ".video video",
      ".cameraContainer video",
      ".videoContainer video",
      ".webcam-container video",
      'div[data-test*="webcam"] video',
      "video[autoplay][playsinline]",
      'video:not([class*="presentation"]):not([class*="screen"])',
    ],
  };

  const selectorList = selectors[platform] || selectors.meet;

  // Enhanced detection with retry mechanism
  for (const selector of selectorList) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (isValidVideoElement(element)) {
        console.log(
          `📹 Enhanced video element found for ${platform}: ${selector}`
        );
        return element;
      }
    }
  }

  console.warn(`⚠️ No suitable video element found for platform: ${platform}`);
  return null;
}

// Enhanced video element validation
function isValidVideoElement(video) {
  if (!video || video.tagName !== "VIDEO") return false;

  // Check basic video properties
  if (video.videoWidth <= 0 || video.videoHeight <= 0) return false;

  // Skip muted videos (usually not user camera)
  if (video.muted) return false;

  // Skip very small videos (likely thumbnails)
  if (video.videoWidth < 80 || video.videoHeight < 60) return false;

  // Skip presentation/screen share videos
  const classList = video.className.toLowerCase();
  const id = video.id.toLowerCase();
  const ariaLabel = (video.getAttribute("aria-label") || "").toLowerCase();

  if (
    classList.includes("presentation") ||
    classList.includes("screen") ||
    classList.includes("desktop") ||
    id.includes("screen") ||
    id.includes("presentation") ||
    ariaLabel.includes("screen") ||
    ariaLabel.includes("presentation")
  ) {
    return false;
  }

  // Check if video has actual content (not black screen)
  try {
    if (video.readyState >= 2) {
      // HAVE_CURRENT_DATA
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = 50;
      canvas.height = 50;

      ctx.drawImage(video, 0, 0, 50, 50);
      const imageData = ctx.getImageData(0, 0, 50, 50);

      // Check if image has any non-black pixels
      const hasContent = imageData.data.some((pixel, index) => {
        if (index % 4 === 3) return false; // Skip alpha channel
        return pixel > 20; // Non-black threshold
      });

      if (!hasContent) return false;
    }
  } catch (error) {
    // If canvas test fails, still consider it valid
    console.log("Canvas test failed, assuming valid video:", error);
  }

  return true;
}

// Background Service Worker Proxy Functions
async function sendToBackground(action, data = {}) {
  return new Promise((resolve) => {
    const message = {
      action: action,
      ...data,
      apiKey: analysisState.apiKey,
      timeout: 8000,
    };

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Background communication error:",
          chrome.runtime.lastError
        );
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { success: false, error: "No response" });
      }
    });
  });
}

// Global state instance
const analysisState = new StudentAnalysisState();

// Backward compatibility aliases (deprecated - will be removed in v3.0)
let studentName,
  userId,
  analysisActive,
  serverUrl,
  analysisInterval,
  lastAnalysis;
let serverHealthy,
  connectionRetries,
  maxRetries,
  settingsCheckInterval,
  analysisLoop;

// Sync with state object
function syncLegacyVariables() {
  studentName = analysisState.studentName;
  userId = analysisState.userId;
  analysisActive = analysisState.analysisActive;
  serverUrl = analysisState.serverUrl;
  analysisInterval = analysisState.analysisInterval;
  lastAnalysis = analysisState.lastAnalysis;
  serverHealthy = analysisState.serverHealthy;
  connectionRetries = analysisState.connectionRetries;
  maxRetries = analysisState.maxRetries;
  settingsCheckInterval = analysisState.settingsCheckInterval;
  analysisLoop = analysisState.analysisLoop;
}

async function loadStudentSettings() {
  try {
    // Chrome extension context kontrolü
    if (!chrome || !chrome.storage) {
      console.warn(
        "⚠️ Chrome storage erişim yok, varsayılan ayarlar kullanılıyor"
      );
      analysisState.serverUrl = "http://127.0.0.1:5001";
      analysisState.analysisInterval = 3000;
      return;
    }

    // Extension context invalidation kontrolü
    if (chrome.runtime?.lastError) {
      console.error("❌ Extension context hatası:", chrome.runtime.lastError);
      showContextInvalidationError();
      return;
    }

    const result = await chrome.storage.sync.get([
      "serverUrl",
      "apiKey",
      "studentName",
      "userId",
      "notificationsEnabled",
    ]);

    // Update state object
    analysisState.serverUrl = result.serverUrl || "http://127.0.0.1:5001";
    analysisState.apiKey = result.apiKey || "";
    analysisState.analysisInterval = result.analysisInterval || 3000;
    // Interval will be governed by teacher via server; default fallback
    analysisState.analysisInterval = 3000;
    analysisState.studentName = result.studentName;
    analysisState.userId = result.userId;
    analysisState.notificationsEnabled = result.notificationsEnabled !== false;

    // Sync legacy variables
    syncLegacyVariables();

    console.log("🎓 Öğrenci ayarları yüklendi:", {
      serverUrl: analysisState.serverUrl,
      apiKey: analysisState.apiKey ? "✅ Mevcut" : "❌ Eksik",
      interval: analysisState.analysisInterval,
      studentName: analysisState.studentName,
      notifications: analysisState.notificationsEnabled,
    });

    // Server'dan güncel ayarları al - gerçek toplantı sayfasında
    if (isInMeetingPage()) {
      await fetchServerSettings();
    } else {
      console.log("⏸️ Toplantı sayfası değil - server ayarları atlanıyor");
    }

    // Listen for settings updates
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "SETTINGS_UPDATED") {
          console.log("⚙️ Ayarlar güncellendi:", message.settings);

          // Update state
          analysisState.serverUrl =
            message.settings.serverUrl || analysisState.serverUrl;
          analysisState.analysisInterval =
            // analysisInterval no longer set by student; keep server-controlled
            analysisState.notificationsEnabled =
              message.settings.notificationsEnabled !== false;

          syncLegacyVariables();

          // Restart analysis with new settings
          // Ensure analysis is running after settings update
          setTimeout(() => {
            chrome.runtime.sendMessage({ action: "ping" }, () => {
              // If active, restart loop; if not active but we have identity, start
              if (analysisState.analysisActive) {
                restartAnalysis();
              } else if (analysisState.studentName && analysisState.userId) {
                startAnalysis();
              }
            });
          }, 300);

          sendResponse({ status: "settings_applied" });
        }
      });
    }
  } catch (error) {
    console.error("❌ Ayar yükleme hatası:", error);

    // Chrome extension context invalidation kontrolü
    if (
      error.message &&
      error.message.includes("Extension context invalidated")
    ) {
      console.error("🔄 Extension context invalidated - yeniden yüklenmeli");
      showContextInvalidationError();
      return;
    }

    console.warn("⚠️ Varsayılan ayarlar kullanılıyor");
    analysisState.serverUrl = "https://localhost:5001";
    analysisState.analysisInterval = 3000;
    syncLegacyVariables();
  }
}

// SERVER SENKRONIZASYONU - KRİTİK EKLENTİ
async function fetchServerSettings() {
  try {
    // Yalnızca gerçek toplantı sayfasında server ayarlarını al
    if (!isInMeetingPage()) {
      console.log("⏸️ Toplantı sayfası değil - server ayarları atlanıyor");
      return;
    }

    // Background proxy üzerinden istek
    const proxied = await sendToBackground("NETWORK_REQUEST", {
      url: `${analysisState.serverUrl}/teacher-settings`,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(analysisState.apiKey ? { "X-API-KEY": analysisState.apiKey } : {}),
      },
      timeout: 5000,
    });

    if (proxied && proxied.success && proxied.data) {
      const data = proxied.data;
      if (data.success && data.settings) {
        const newInterval = data.settings.analysis_interval;
        if (newInterval && newInterval !== analysisInterval) {
          analysisInterval = newInterval;
          console.log(`⚙️ Analiz frekansı güncellendi: ${newInterval}ms`);

          // Aktif analizi yeniden başlat
          if (analysisActive) {
            restartAnalysis();
          }
        }
        serverHealthy = true;
        connectionRetries = 0;
      }
    } else if (proxied && !proxied.success && proxied.status === 401) {
      console.warn("⚠️ API key geçersiz, ayarlarda kontrol edin");
      serverHealthy = false;
    }
  } catch (error) {
    // SSL sertifika hatası özel mesajı
    if (error.message && error.message.includes("Failed to fetch")) {
      console.error("❌ SSL Sertifika Hatası:", error.message);
      console.error(
        "🔧 Çözüm: Chrome'da http://127.0.0.1:5001/health adresine git"
      );
      console.error("🔧 'Advanced' → 'Proceed to localhost (unsafe)' tıkla");
    } else {
      console.warn("⚠️ Server ayarları alınamadı:", error.message);
    }
    serverHealthy = false;
    connectionRetries++;
  }
}

// NETWORK RECOVERY SİSTEMİ
async function checkServerHealth() {
  try {
    const response = await sendToBackground("HEALTH_CHECK", {
      baseUrl: analysisState.serverUrl,
    });

    if (response && response.success) {
      serverHealthy = true;
      connectionRetries = 0;
      console.log("💚 Server bağlantısı sağlıklı");
      return true;
    }
  } catch (error) {
    serverHealthy = false;
    connectionRetries++;

    // SSL sertifika hatası özel mesajı
    if (error.message && error.message.includes("Failed to fetch")) {
      console.error(
        `❌ SSL Sertifika Hatası (Deneme ${connectionRetries}/${maxRetries}):`,
        error.message
      );
      console.error(
        "🔧 Çözüm: Chrome'da http://127.0.0.1:5001/health adresine git"
      );
      console.error("🔧 'Advanced' → 'Proceed to localhost (unsafe)' tıkla");
    } else {
      console.warn(
        `❌ Server bağlantı hatası (Deneme ${connectionRetries}/${maxRetries}):`,
        error.message
      );
    }

    if (connectionRetries >= maxRetries) {
      // SSL hatası ise özel mesaj göster
      if (error.message && error.message.includes("Failed to fetch")) {
        showConnectionError({ type: "ssl" });
      } else {
        showConnectionError();
      }
    }
  }
  return false;
}

function showConnectionError(details = {}) {
  // Don't spam error messages
  if (document.getElementById("connection-error-notification")) {
    return;
  }

  const errorDiv = document.createElement("div");
  errorDiv.id = "connection-error-notification";
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #e74c3c, #c0392b);
    color: white;
    padding: 20px;
    border-radius: 12px;
    z-index: 100000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 350px;
    box-shadow: 0 8px 32px rgba(231, 76, 60, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
  `;

  const errorType = details.type || "connection";
  let errorContent = "";

  switch (errorType) {
    case "ssl":
      errorContent = `
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 20px; margin-right: 10px;">🔒</span>
          <strong>SSL Sertifika Sorunu</strong>
        </div>
        <div style="margin-bottom: 15px;">
          Chrome self-signed SSL sertifikasını kabul etmiyor.
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
          <button onclick="window.open('http://127.0.0.1:5001/health', '_blank')" 
                  style="padding: 8px 12px; background: rgba(255,255,255,0.9); 
                         border: none; color: #c0392b; border-radius: 6px; cursor: pointer; 
                         font-size: 12px; font-weight: bold;">
            🔧 SSL Düzelt
          </button>
        </div>
        <div style="font-size: 12px; opacity: 0.8;">
          1. SSL Düzelt butonuna tıklayın<br>
          2. "Advanced" → "Proceed to localhost" seçin<br>
          3. Extension'ı yeniden yükleyin
        </div>
      `;
      break;
    case "connection":
      errorContent = `
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 20px; margin-right: 10px;">🔌</span>
          <strong>Bağlantı Sorunu</strong>
        </div>
        <div style="margin-bottom: 15px;">
          Öğretmen sunucusuna erişilemiyor.<br>
          <small style="opacity: 0.9;">Server: ${serverUrl}</small>
        </div>
        <div style="font-size: 12px; opacity: 0.8;">
          • Ayarlar'dan sunucu adresini kontrol edin<br>
          • Öğretmeninizden doğru IP'yi alın<br>
          • İnternet bağlantınızı kontrol edin
        </div>
      `;
      break;
    case "camera":
      errorContent = `
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 20px; margin-right: 10px;">📷</span>
          <strong>Kamera Sorunu</strong>
        </div>
        <div style="margin-bottom: 15px;">
          Video akışına erişilemiyor.
        </div>
        <div style="font-size: 12px; opacity: 0.8;">
          • Kamera izinlerini kontrol edin<br>
          • Sayfayı yenileyin<br>
          • Video konferans uygulamasını yeniden başlatın
        </div>
      `;
      break;
    case "analysis":
      errorContent = `
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 20px; margin-right: 10px;">🔍</span>
          <strong>Analiz Sorunu</strong>
        </div>
        <div style="margin-bottom: 15px;">
          Duygu analizi yapılamıyor.<br>
          <small style="opacity: 0.9;">${
            details.message || "Bilinmeyen hata"
          }</small>
        </div>
        <div style="font-size: 12px; opacity: 0.8;">
          • Yüzünüzün kameraya görünür olduğundan emin olun<br>
          • Işık durumunu iyileştirin<br>
          • Analizi yeniden başlatın
        </div>
      `;
      break;
    default:
      errorContent = `
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 20px; margin-right: 10px;">⚠️</span>
          <strong>Sistem Sorunu</strong>
        </div>
        <div style="margin-bottom: 15px;">
          ${details.message || "Beklenmeyen bir hata oluştu."}
        </div>
      `;
  }

  errorDiv.innerHTML = `
    ${errorContent}
    <div style="display: flex; gap: 10px; margin-top: 15px;">
      <button onclick="chrome.tabs.create({url: 'settings.html'})" 
              style="flex: 1; padding: 8px; background: rgba(255,255,255,0.2); 
                     border: none; color: white; border-radius: 6px; cursor: pointer; font-size: 12px;">
        ⚙️ Ayarlar
      </button>
      <button onclick="this.parentElement.parentElement.remove()" 
              style="flex: 1; padding: 8px; background: rgba(255,255,255,0.1); 
                     border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 6px; cursor: pointer; font-size: 12px;">
        ✕ Kapat
      </button>
    </div>
  `;

  document.body.appendChild(errorDiv);

  // Auto remove after 15 seconds
  setTimeout(() => {
    if (document.getElementById("connection-error-notification")) {
      errorDiv.remove();
    }
  }, 15000);
}

function showContextInvalidationError() {
  // Context invalidation error'ı sadece bir kez göster
  if (document.getElementById("context-invalidation-error")) {
    return;
  }

  const errorDiv = document.createElement("div");
  errorDiv.id = "context-invalidation-error";
  errorDiv.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 999999;
    background: linear-gradient(45deg, #ff6b6b, #ee5a24);
    color: white; padding: 20px; border-radius: 10px;
    font-family: Arial, sans-serif; font-size: 14px;
    max-width: 350px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.2);
  `;

  errorDiv.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 10px;">
      <span style="font-size: 20px; margin-right: 10px;">🔄</span>
      <strong>Extension Yeniden Yüklenmeli!</strong>
    </div>
    <div style="margin-bottom: 15px; line-height: 1.4;">
      Chrome extension context'i geçersiz hale geldi. Extension'ı yeniden yüklemek gerekiyor.
    </div>
    <div style="display: flex; gap: 10px;">
      <button onclick="window.open('chrome://extensions/', '_blank')" 
              style="flex: 2; padding: 8px; background: rgba(255,255,255,0.9); 
                     border: none; color: #ee5a24; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold;">
        🔧 Extensions Sayfası
      </button>
      <button onclick="location.reload()" 
              style="flex: 1; padding: 8px; background: rgba(255,255,255,0.1); 
                     border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 6px; cursor: pointer; font-size: 12px;">
        🔄 Yenile
      </button>
      <button onclick="this.parentElement.parentElement.remove()" 
              style="flex: 1; padding: 8px; background: rgba(255,255,255,0.1); 
                     border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 6px; cursor: pointer; font-size: 12px;">
        ✕ Kapat
      </button>
    </div>
  `;

  document.body.appendChild(errorDiv);
}

function restartAnalysis() {
  if (analysisLoop) {
    clearInterval(analysisLoop);
  }
  if (analysisActive) {
    startAnalysisLoop();
  }
}

// ==================== MANUEL FEEDBACK BUTTONS ====================

/**
 * Sayfanın sol üst köşesine manuel feedback butonları ekler
 */
function injectManualFeedbackButtons() {
  // Zaten varsa tekrar ekleme
  if (document.getElementById("manual-feedback-container")) {
    return;
  }

  const container = document.createElement("div");
  container.id = "manual-feedback-container";
  container.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    display: flex;
    gap: 10px;
    z-index: 99999;
    user-select: none;
    cursor: grab;
  `;

  const feedbackButtons = [
    {
      id: "confused-btn",
      emoji: "🤔",
      label: "Kafam Karıştı",
      emotion: "confused",
      color: "linear-gradient(135deg, #e67e22, #d35400)",
    },
    {
      id: "frustrated-btn",
      emoji: "😤",
      label: "Sıkıldım / Zorlanıyorum",
      emotion: "frustrated",
      color: "linear-gradient(135deg, #e74c3c, #c0392b)",
    },
    {
      id: "sleepy-btn",
      emoji: "😴",
      label: "Uykum Geldi",
      emotion: "sleepy",
      color: "linear-gradient(135deg, #95a5a6, #7f8c8d)",
    },
  ];

  feedbackButtons.forEach((btn) => {
    const button = document.createElement("button");
    button.id = btn.id;
    button.innerHTML = btn.emoji;
    button.title = btn.label;
    button.style.cssText = `
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: 3px solid white;
      background: ${btn.color};
      color: white;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    button.addEventListener("mouseenter", () => {
      button.style.transform = "scale(1.1)";
      button.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.4)";
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "scale(1)";
      button.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    });

    button.addEventListener("click", () => {
      sendManualFeedback(btn.emotion, btn.label);
      // Animasyon efekti
      button.style.transform = "scale(0.95)";
      setTimeout(() => {
        button.style.transform = "scale(1.2)";
        setTimeout(() => {
          button.style.transform = "scale(1)";
        }, 200);
      }, 100);
    });

    container.appendChild(button);
  });

  document.body.appendChild(container);
  console.log("✅ Manuel feedback butonları eklendi");

  // Draggable behavior with persistence
  try {
    // Restore last position if available
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["manualButtonsPos"], (res) => {
        const pos = res && res.manualButtonsPos;
        if (
          pos &&
          typeof pos.top === "number" &&
          typeof pos.left === "number"
        ) {
          container.style.top = `${Math.max(0, pos.top)}px`;
          container.style.left = `${Math.max(0, pos.left)}px`;
        }
      });
    }

    let isDragging = false;
    let dragStarted = false;
    let startX = 0,
      startY = 0,
      origLeft = 0,
      origTop = 0;

    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
    const parsePx = (v, fallback) => {
      const n = parseInt(String(v || "").replace("px", ""), 10);
      return Number.isFinite(n) ? n : fallback;
    };

    const onPointerDown = (clientX, clientY, targetTag) => {
      // Allow dragging even on buttons, but we'll cancel the click if drag distance > threshold
      isDragging = true;
      dragStarted = false;
      startX = clientX;
      startY = clientY;
      const rect = container.getBoundingClientRect();
      // Use computed rect to support unset inline values
      origLeft = parsePx(container.style.left, rect.left);
      origTop = parsePx(container.style.top, rect.top);
      container.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    };

    const onPointerMove = (clientX, clientY) => {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if (!dragStarted && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        dragStarted = true;
      }
      const maxLeft = (window.innerWidth || 0) - container.offsetWidth - 8;
      const maxTop = (window.innerHeight || 0) - container.offsetHeight - 8;
      const nextLeft = clamp(origLeft + dx, 0, Math.max(0, maxLeft));
      const nextTop = clamp(origTop + dy, 0, Math.max(0, maxTop));
      container.style.left = `${nextLeft}px`;
      container.style.top = `${nextTop}px`;
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      container.style.cursor = "grab";
      document.body.style.userSelect = "";
      // Persist position
      try {
        const top = parsePx(container.style.top, 20);
        const left = parsePx(container.style.left, 20);
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ manualButtonsPos: { top, left } });
        }
      } catch {}
    };

    // Mouse events
    container.addEventListener("mousedown", (e) => {
      // Left mouse only
      if (e.button !== 0) return;
      onPointerDown(e.clientX, e.clientY, e.target && e.target.tagName);
      // If dragging surpasses threshold, prevent the subsequent click once
      const clickBlocker = (ev) => {
        if (dragStarted) {
          ev.stopPropagation();
          ev.preventDefault();
        }
        container.removeEventListener("click", clickBlocker, true);
      };
      container.addEventListener("click", clickBlocker, true);
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) =>
      onPointerMove(e.clientX, e.clientY)
    );
    document.addEventListener("mouseup", onPointerUp);

    // Touch events
    container.addEventListener(
      "touchstart",
      (e) => {
        if (!e.touches || e.touches.length === 0) return;
        const t = e.touches[0];
        onPointerDown(t.clientX, t.clientY, e.target && e.target.tagName);
        e.preventDefault();
      },
      { passive: false }
    );
    document.addEventListener(
      "touchmove",
      (e) => {
        if (!e.touches || e.touches.length === 0) return;
        const t = e.touches[0];
        onPointerMove(t.clientX, t.clientY);
      },
      { passive: false }
    );
    document.addEventListener("touchend", onPointerUp);
    document.addEventListener("touchcancel", onPointerUp);
  } catch (e) {
    console.warn("⚠️ Draggable setup failed:", e);
  }
}

/**
 * Manuel feedback'i sessizce backend'e kaydeder (öğretmen görmez, sadece export'ta görünür)
 */
async function sendManualFeedback(emotion, label) {
  // Validasyon 1: Öğrenci bilgisi kontrolü
  if (!studentName || !userId) {
    console.warn("⚠️ Öğrenci bilgisi yok, feedback gönderilemedi");
    showFeedbackToast("⚠️ Lütfen analizi başlatın", true);
    return;
  }

  // Validasyon 2: Server URL kontrolü
  if (!analysisState.serverUrl) {
    console.error("❌ Server URL tanımlı değil!");
    console.error("   analysisState:", analysisState);
    showFeedbackToast("❌ Backend URL eksik", true);
    return;
  }

  console.log(`📤 Manuel feedback sessizce kaydediliyor: ${label}`);
  console.log(`   Öğrenci: ${studentName}, UserID: ${userId}`);
  console.log(`   Emotion: ${emotion}, Label: ${label}`);
  console.log(`   Server URL: ${analysisState.serverUrl}`);

  const feedbackData = {
    studentName: studentName,
    userId: userId,
    origin: "student", // açıkça öğrenciden geldiğini belirt
    manualFeedback: {
      emotion: emotion,
      label: label,
      timestamp: Date.now(),
      confidence: 1.0,
      source: "manual",
      origin: "student",
    },
  };

  console.log("📤 Gönderilen payload:", JSON.stringify(feedbackData, null, 2));

  try {
    const response = await sendToBackground("SEND_MANUAL_FEEDBACK", {
      baseUrl: analysisState.serverUrl,
      feedbackData: feedbackData,
      apiKey: analysisState.apiKey || "",
    });

    console.log("📥 Backend yanıtı:", response);
    console.log("📥 Yanıt tipi:", typeof response);
    console.log("📥 Yanıt keys:", response ? Object.keys(response) : "null");

    if (response && response.success) {
      console.log(
        `✅ Manuel feedback sessizce kaydedildi: ${label} (öğretmen görmez)`
      );
      showFeedbackToast(`${label} kaydedildi ✓`);
    } else {
      console.error("❌ Manuel feedback gönderilemedi:", response);

      // Detaylı hata analizi
      let errorMsg = "Bilinmeyen hata";
      if (response) {
        errorMsg =
          response.error || response.message || JSON.stringify(response);
      }

      console.error("   Hata detayı:", errorMsg);
      console.error("   HTTP Status:", response?.status);
      console.error("   Response body:", response?.body);

      showFeedbackToast(`Kayıt başarısız: ${errorMsg}`, true);
    }
  } catch (error) {
    console.error("❌ Manuel feedback hatası:", error);
    console.error("   Error message:", error.message);
    console.error("   Error name:", error.name);
    console.error("   Stack:", error.stack);
    showFeedbackToast("Bağlantı hatası ✗", true);
  }
}

/**
 * Kullanıcıya toast bildirim gösterir
 */
function showFeedbackToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: ${isError ? "#e74c3c" : "#27ae60"};
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 999999;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  toast.textContent = message;

  document.body.appendChild(toast);

  // Fade in
  setTimeout(() => {
    toast.style.opacity = "1";
  }, 10);

  // Fade out and remove
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 2500);
}

async function initializeStudent() {
  try {
    const result = await chrome.storage.local.get(["studentName", "userId"]);

    if (result.studentName && result.userId) {
      studentName = result.studentName;
      userId = result.userId;
      console.log(`🎓 Mevcut öğrenci: ${studentName}`);
      return { studentName, userId };
    }

    const studentInfo = await requestStudentInfo();
    if (studentInfo) {
      studentName = studentInfo.studentName;
      userId = studentInfo.userId;

      await chrome.storage.local.set({
        studentName,
        userId,
        userRole: "student",
      });

      await chrome.storage.sync.set({ studentName, userId });

      console.log(`✅ Öğrenci kaydedildi: ${studentName}`);
      return studentInfo;
    }
  } catch (error) {
    console.error("❌ Öğrenci başlatma hatası:", error);
  }
  return null;
}

function requestStudentInfo() {
  return new Promise((resolve) => {
    const modal = createStudentModal();
    document.body.appendChild(modal);

    const nameInput = modal.querySelector("#student-name-input");
    const startBtn = modal.querySelector("#start-analysis-btn");
    const cancelBtn = modal.querySelector("#cancel-student-info");

    startBtn.onclick = () => {
      const name = nameInput.value.trim();
      if (name && name.length >= 2) {
        const userId = generateStudentId();
        modal.remove();
        resolve({ studentName: name, userId });
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
        startBtn.click();
      }
    });

    setTimeout(() => nameInput.focus(), 100);
  });
}

function createStudentModal() {
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
      background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
      color: white;
      padding: 35px;
      border-radius: 20px;
      box-shadow: 0 25px 80px rgba(0,0,0,0.4);
      max-width: 420px;
      width: 90%;
      text-align: center;
      border: 3px solid rgba(255,255,255,0.2);
    ">
      <h2 style="margin: 0 0 10px 0; font-size: 26px;">🎓 Sanal Sınıfa Hoş Geldiniz</h2>
      <p style="margin: 0 0 25px 0; opacity: 0.9; font-size: 15px; line-height: 1.4;">
        Dersin daha etkili geçmesi için akıllı katılım asistanını başlatın
      </p>
      
      <input 
        type="text" 
        id="student-name-input"
        placeholder="Adınızı ve soyadınızı girin"
        style="
          width: 100%;
          padding: 16px;
          font-size: 16px;
          border: none;
          border-radius: 12px;
          margin-bottom: 25px;
          box-sizing: border-box;
          outline: none;
          background: rgba(255,255,255,0.95);
          color: #333;
          text-align: center;
        "
      />
      
      <div style="display: flex; gap: 12px;">
        <button id="cancel-student-info" style="
          flex: 1;
          padding: 14px;
          background: rgba(255,255,255,0.2);
          color: white;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 12px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
        ">İptal</button>
        
        <button id="start-analysis-btn" style="
          flex: 2;
          padding: 14px;
          background: rgba(255,255,255,0.95);
          color: #0984e3;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 700;
        ">📊 Analizi Başlat</button>
      </div>
      
      <p style="font-size: 11px; margin: 20px 0 0 0; opacity: 0.8; line-height: 1.3;">
        🔒 Bu asistan derse odaklanmanızı artırır<br>
        Verileriniz güvenli ve anonim şekilde işlenir
      </p>
    </div>
  `;

  return modal;
}

function generateStudentId() {
  return (
    "student_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8)
  );
}

async function captureAndAnalyzeVideo() {
  if (!analysisActive || !studentName) return;

  try {
    const myVideo = await findMyVideoStream();
    if (!myVideo) {
      console.log("🎥 Kendi video akışı bulunamadı");
      return;
    }

    // Video boyut ve kalite kontrolü
    if (myVideo.videoWidth < 120 || myVideo.videoHeight < 90) {
      console.warn("⚠️ Video çözünürlüğü çok düşük");
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Adaptif boyutlandırma
    const aspectRatio = myVideo.videoWidth / myVideo.videoHeight;
    canvas.width = Math.min(320, myVideo.videoWidth);
    canvas.height = Math.round(canvas.width / aspectRatio);

    // Video frame'i yakala
    ctx.drawImage(myVideo, 0, 0, canvas.width, canvas.height);

    // Image kalitesi kontrolü
    const imageData = canvas.toDataURL("image/jpeg", 0.85);
    if (imageData.length < 5000) {
      // Çok küçük image
      console.warn("⚠️ Yakalanan görüntü çok küçük");
      return;
    }

    const analysisResult = await sendImageToServer(imageData);
    if (analysisResult) {
      await reportToTeacher(analysisResult);
    }
  } catch (error) {
    console.error("❌ Video analiz hatası:", error);
  }
}

// GELİŞMİŞ VIDEO BULMA ALGORİTMASI
async function findMyVideoStream() {
  const videos = document.querySelectorAll("video");

  // 1. Öncelik: Muted olmayan, aktif video
  let myVideo = Array.from(videos).find(
    (video) =>
      video.srcObject &&
      video.readyState >= 2 &&
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      !video.muted &&
      video.currentTime > 0
  );

  // 2. Öncelik: Boyut kontrolü ile
  if (!myVideo) {
    myVideo = Array.from(videos).find(
      (video) =>
        video.srcObject &&
        video.readyState >= 2 &&
        video.videoWidth >= 160 &&
        video.videoHeight >= 120
    );
  }

  // 3. Öncelik: Herhangi bir aktif video
  if (!myVideo) {
    myVideo = Array.from(videos).find(
      (video) => video.srcObject && video.readyState >= 1 && !video.paused
    );
  }

  // 4. Son şans: Canvas ile kontrol
  if (!myVideo && videos.length > 0) {
    for (const video of videos) {
      if (await testVideoCapture(video)) {
        myVideo = video;
        break;
      }
    }
  }

  return myVideo;
}

// Video yakalama testi
async function testVideoCapture(video) {
  try {
    if (!video.srcObject || video.readyState < 1) return false;

    const testCanvas = document.createElement("canvas");
    const testCtx = testCanvas.getContext("2d");

    testCanvas.width = 100;
    testCanvas.height = 100;

    testCtx.drawImage(video, 0, 0, 100, 100);
    const testData = testCtx.getImageData(0, 0, 100, 100);

    // Tamamen siyah değil mi kontrol et
    const hasContent = testData.data.some((pixel) => pixel > 10);

    return hasContent;
  } catch {
    return false;
  }
}

async function sendImageToServer(imageData) {
  // Server sağlığını kontrol et
  if (!serverHealthy && connectionRetries > 0) {
    const healthCheck = await checkServerHealth();
    if (!healthCheck) {
      return null;
    }
  }

  try {
    const response = await sendToBackground("ANALYZE_EMOTION", {
      baseUrl: analysisState.serverUrl,
      imageData: imageData,
      studentName: studentName,
      userId: userId,
    });

    if (!response || !response.success) {
      throw new Error(response?.error || "Analyze failed");
    }

    const result = response.data;
    console.log("🧠 AI Analiz sonucu:", result.emotions?.[0]?.emotion);

    // Başarılı analiz sonrası server sağlıklı olarak işaretle
    serverHealthy = true;
    connectionRetries = 0;

    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("❌ Server analiz timeout");
    } else {
      console.error("❌ Server analiz hatası:", error);
    }

    // Bağlantı hatası durumunda server sağlığını kontrol et
    serverHealthy = false;
    connectionRetries++;

    return null;
  }
}

async function reportToTeacher(analysisResult) {
  try {
    await chrome.storage.local.get(["analysisHistory"], (result) => {
      const history = result.analysisHistory || [];
      history.push({
        studentName,
        userId,
        emotions: analysisResult.emotions,
        timestamp: Date.now(),
      });

      chrome.storage.local.set({ analysisHistory: history });
    });

    chrome.runtime.sendMessage({
      type: "EMOTION_ANALYSIS_RESULT",
      data: {
        studentName,
        userId,
        emotions: analysisResult.emotions,
        timestamp: Date.now(),
      },
    });

    await sendToTeacherExtension(analysisResult);
  } catch (error) {
    console.error("❌ Öğretmen bildirimi hatası:", error);
  }
}

async function sendToTeacherExtension(analysisResult) {
  try {
    const response = await sendToBackground("SEND_REPORT", {
      baseUrl: analysisState.serverUrl,
      reportData: {
        studentName,
        userId,
        emotions: analysisResult.emotions,
        timestamp: Date.now(),
        type: "emotion_update",
      },
    });

    if (response && response.success) {
      console.log("📡 Öğretmene rapor gönderildi");
    }
  } catch (error) {
    console.log("⚠️ Öğretmen raporu gönderilemedi:", error.message);
  }
}

function startAnalysis() {
  if (analysisActive) return;
  if (!studentName || !userId) {
    // Try to initialize identity quickly
    initializeStudent().then((info) => {
      if (info) startAnalysis();
    });
    return;
  }

  analysisActive = true;
  console.log("🎯 Gizli duygu analizi başlatıldı:", studentName);

  // Persist session start for popup timer accuracy
  try {
    chrome.storage.local.set({ analysisSessionStart: Date.now() });
  } catch {}

  // Manuel feedback butonlarını inject et
  injectManualFeedbackButtons();

  startAnalysisLoop();
  startSettingsSync();

  chrome.runtime.sendMessage({
    type: "STUDENT_READY",
    studentName: studentName,
    userId: userId,
  });
}

function startAnalysisLoop() {
  if (analysisLoop) {
    clearInterval(analysisLoop);
  }

  analysisLoop = setInterval(async () => {
    if (!analysisActive) {
      clearInterval(analysisLoop);
      return;
    }

    const now = Date.now();
    if (now - lastAnalysis >= analysisInterval) {
      lastAnalysis = now;
      await captureAndAnalyzeVideo();
    }
  }, 1000);

  // Watchdog to ensure loop keeps running (in case timers are cleared by page/popup lifecycle)
  if (!window.__analysisWatchdog) {
    window.__analysisWatchdog = setInterval(() => {
      if (analysisActive && !analysisLoop) {
        try {
          startAnalysisLoop();
        } catch {}
      }
    }, 5000);
  }
}

function startSettingsSync() {
  if (settingsCheckInterval) {
    clearInterval(settingsCheckInterval);
  }

  // Her 10 saniyede server ayarlarını kontrol et - sadece meet odalarında
  settingsCheckInterval = setInterval(async () => {
    const currentUrl = window.location.href;
    if (
      analysisActive &&
      !currentUrl.includes("/landing") &&
      !currentUrl.includes("/preview") &&
      !currentUrl.includes("/join") &&
      currentUrl.match(/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/)
    ) {
      await fetchServerSettings();
    }
  }, 10000);
}

function stopAnalysis() {
  // Clean loop timers but keep identity so restart is possible
  try {
    if (settingsCheckInterval) clearInterval(settingsCheckInterval);
    if (analysisLoop) clearInterval(analysisLoop);
  } catch {}
  settingsCheckInterval = null;
  analysisLoop = null;
  analysisActive = false;

  // Persist session stop for popup timer reset
  try {
    chrome.storage.local.remove(["analysisSessionStart"]);
  } catch {}

  console.log("⏹️ Duygu analizi durduruldu");
}

// Relax lifecycle handlers: don't auto-stop on tab hide; only stop on full unload
window.addEventListener("beforeunload", () => {
  try {
    stopAnalysis();
  } catch {}
});

// Chrome extension message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === "checkAnalysisStatus") {
      sendResponse({ active: analysisActive, studentName, userId });
      return true;
    }

    if (message.action === "startAnalysis") {
      if (!analysisActive && studentName) {
        startAnalysis();
        sendResponse({ success: true, message: "Analysis started" });
      } else {
        sendResponse({ success: false, message: "Cannot start analysis" });
      }
      return true;
    }

    if (message.action === "stopAnalysis") {
      if (analysisActive) {
        stopAnalysis();
        sendResponse({ success: true, message: "Analysis stopped" });
      } else {
        sendResponse({ success: false, message: "Analysis not active" });
      }
      return true;
    }

    if (message.action === "getStudentInfo") {
      sendResponse({
        studentName,
        userId,
        analysisActive,
        serverHealthy,
        connectionRetries,
      });
      return true;
    }
  } catch (error) {
    console.error("❌ Message handling error:", error);
    sendResponse({ success: false, error: error.message });
  }

  return true;
});

// Do not stop analysis on visibility change; keep running in background tab
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    console.log("😴 Sayfa gizlendi; analiz çalışmaya devam ediyor");
  } else if (document.visibilityState === "visible") {
    console.log("👁️ Sayfa görünür; analiz durumu:", analysisActive);
  }
});

// Page unload cleanup
window.addEventListener("beforeunload", () => {
  try {
    stopAnalysis();
  } finally {
    console.log("👋 Sayfa kapatılıyor, analiz durduruldu");
  }
});

// Network change detection
window.addEventListener("online", () => {
  console.log("🌐 İnternet bağlantısı yeniden kuruldu");
  if (studentName && !analysisActive) {
    setTimeout(() => {
      checkServerHealth().then((isHealthy) => {
        if (isHealthy) {
          startAnalysis();
        }
      });
    }, 2000);
  }
});

window.addEventListener("offline", () => {
  console.log("❌ İnternet bağlantısı kesildi");
  // Do not immediately stop; allow transient offline. If it persists, health checks will fail.
});

// Main initialization
window.addEventListener("load", async () => {
  console.log("🎓 Öğrenci sayfası yüklendi");

  const initIfMeeting = async () => {
    if (!isInMeetingPage()) {
      console.log(
        "⏸️ Toplantı sayfasında değil (rooms/landing). Öğrenci analizi başlatılmıyor."
      );
      return false;
    }

    try {
      await loadStudentSettings();
      await checkServerHealth();
      // BBB ekranı yüklendikten sonra +1s bekle ve isim iste
      const platform = getCurrentPlatform();
      if (platform === "bbb") {
        await waitForBBBReady();
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        // Other platforms: small delay to avoid clashes
        await new Promise((r) => setTimeout(r, 500));
      }

      const studentInfo = await initializeStudent();
      if (studentInfo) {
        console.log("✅ Öğrenci bilgileri hazır, analiz başlatılıyor...");
        setTimeout(() => startAnalysis(), 1500);
        return true;
      } else {
        console.warn("⚠️ Öğrenci bilgileri alınamadı");
      }
    } catch (error) {
      console.error("❌ Initialization error:", error);
      if (
        error.message &&
        error.message.includes("Extension context invalidated")
      ) {
        console.error("🔄 Extension context invalidated during initialization");
        showContextInvalidationError();
      }
    }
    return false;
  };

  // Attempt immediate init
  const started = await initIfMeeting();
  if (!started) {
    // Watch URL for transitions into a real meeting (BBB/Meet/Zoom)
    let lastHref = location.href;
    const watcher = setInterval(async () => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        if (await initIfMeeting()) {
          clearInterval(watcher);
        }
      }
    }, 1500);
  }
});

// Global Chrome Extension Error Handler
window.addEventListener("error", (event) => {
  if (
    event.error &&
    event.error.message &&
    event.error.message.includes("Extension context invalidated")
  ) {
    console.error("🔄 Global extension context invalidation caught");
    showContextInvalidationError();
  }
});

// Chrome runtime error listener
if (chrome && chrome.runtime) {
  chrome.runtime.onConnect.addListener(() => {
    // Connection test - context geçerli mi?
  });
}

console.log("🎓 Student Emotion Extension - Error Handling Enhanced");
