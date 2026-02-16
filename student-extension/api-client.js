// Enhanced API Client with Authentication
// Replaces hard-coded server URLs and adds API key support

class EmotionAPIClient {
  constructor() {
    this.baseURL = null;
    this.apiKey = null;
    this.isConfigured = false;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  async initialize() {
    try {
      const result = await chrome.storage.sync.get(["serverUrl", "apiKey"]);

      this.baseURL = result.serverUrl;
      this.apiKey = result.apiKey;
      this.isConfigured = !!(this.baseURL && this.apiKey);

      if (!this.isConfigured) {
        console.warn(
          "⚠️ API client not configured - missing serverUrl or apiKey"
        );
        return false;
      }

      // Test connection on initialization
      await this.healthCheck();
      return true;
    } catch (error) {
      console.error("❌ API client initialization failed:", error);
      return false;
    }
  }

  async fetchWithAuth(endpoint, options = {}) {
    if (!this.isConfigured) {
      throw new Error("API client not configured - check settings");
    }

    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      "X-API-KEY": this.apiKey,
      ...options.headers,
    };

    // Enhanced timeout handling with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, options.timeout || 8000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error("Invalid API key - check settings");
        } else if (response.status === 403) {
          throw new Error("Access denied - teacher key required");
        } else if (response.status === 429) {
          throw new Error("Rate limit exceeded - slow down requests");
        }
        throw new Error(
          `Server error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      this.retryCount = 0; // Reset on success
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new Error("Request timeout - server may be overloaded");
      }

      // Retry logic for network errors
      if (
        this.retryCount < this.maxRetries &&
        !error.message.includes("API key")
      ) {
        this.retryCount++;
        console.warn(
          `Retry ${this.retryCount}/${this.maxRetries}: ${error.message}`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * this.retryCount)
        );
        return this.fetchWithAuth(endpoint, options);
      }

      throw error;
    }
  }

  async healthCheck() {
    try {
      const result = await this.fetchWithAuth("/health", {
        method: "GET",
        timeout: 5000,
      });
      return result;
    } catch (error) {
      console.error("Health check failed:", error);
      throw error;
    }
  }

  async analyzeEmotion(emotionData) {
    return await this.fetchWithAuth("/analyze", {
      method: "POST",
      body: JSON.stringify(emotionData),
    });
  }

  async getTeacherSettings() {
    // This requires teacher API key
    return await this.fetchWithAuth("/teacher-settings", {
      method: "GET",
    });
  }

  // Utility method to check if properly configured
  isReady() {
    return this.isConfigured;
  }

  // Get configuration status for UI
  getStatus() {
    return {
      configured: this.isConfigured,
      serverUrl: this.baseURL,
      hasApiKey: !!this.apiKey,
      retryCount: this.retryCount,
    };
  }
}

// Global instance - use this instead of direct fetch calls
window.emotionAPI = new EmotionAPIClient();

// Auto-initialize when loaded
(async () => {
  try {
    await window.emotionAPI.initialize();
    console.log("✅ Emotion API client ready");
  } catch (error) {
    console.warn("⚠️ Emotion API client initialization failed:", error.message);
  }
})();

// Backward compatibility wrapper for existing code
async function sendEmotionAnalysis(emotionData) {
  try {
    if (!window.emotionAPI.isReady()) {
      await window.emotionAPI.initialize();
    }
    return await window.emotionAPI.analyzeEmotion(emotionData);
  } catch (error) {
    // Show user-friendly error
    showConnectionError({
      type: "connection",
      message: error.message,
    });
    throw error;
  }
}

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = EmotionAPIClient;
}
