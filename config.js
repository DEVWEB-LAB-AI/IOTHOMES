// ==================== CẤU HÌNH HỆ THỐNG ====================

const CONFIG = {
    // MQTT Configuration
    MQTT: {
        BROKER: 'wss://test.mosquitto.org:8081',  // WebSocket MQTT
        TOPICS: {
            RELAY1: 'home/esp32/relay1',
            RELAY2: 'home/esp32/relay2',
            FEEDBACK1: 'home/esp32/feedback1',
            FEEDBACK2: 'home/esp32/feedback2',
            STATUS: 'home/esp32/status',
            ERROR: 'home/esp32/error'
        }
    },
    
    // WebSocket Configuration (Direct to ESP32)
    WEBSOCKET: {
        PORT: 81,
        RECONNECT_INTERVAL: 3000
    },
    
    // HTTP API
    API: {
        TIMEOUT: 5000,
        RETRY_COUNT: 3
    },
    
    // UI Settings
    UI: {
        REFRESH_INTERVAL: 2000,
        ANIMATION_DURATION: 300,
        TOAST_DURATION: 3000
    },
    
    // Diagnostic Settings
    DIAGNOSTIC: {
        SAMPLES: 50,
        INTERVAL: 100
    }
};

// ==================== BIẾN TOÀN CỤC ====================

let AppState = {
    // Connection status
    mqttConnected: false,
    wsConnected: false,
    
    // Device status
    relay1: false,
    relay2: false,
    feedback1: false,
    feedback2: false,
    error: false,
    
    // Device info
    deviceIP: null,
    lastUpdate: null,
    
    // History
    feedbackHistory1: [],
    feedbackHistory2: [],
    errorLogs: []
};

// ==================== UTILITY FUNCTIONS ====================

const Utils = {
    // Format timestamp
    formatTime: (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('vi-VN');
    },
    
    // Show toast notification
    showToast: (message, type = 'info') => {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast toast-${type}`;
        toast.classList.remove('hidden');
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, CONFIG.UI.TOAST_DURATION);
    },
    
    // Generate unique ID
    generateId: () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    // Debounce function
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};
