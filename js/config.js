// ==================== CONFIGURATION ====================
const CONFIG = {
    // Discovery settings
    DISCOVERY: {
        TIMEOUT: 1000,
        MAX_RETRIES: 3,
        PORTS: [80, 8080],
        MDNS_HOST: 'esp32s3.local'
    },
    
    // API endpoints
    API: {
        STATUS: '/api/status',
        CONTROL: '/api/control',
        DIAGNOSTIC: '/api/diagnostic',
        DISCOVERY: '/api/discovery'
    },
    
    // ✅ THÊM MQTT CONFIG
    MQTT: {
        BROKER: 'ws://test.mosquitto.org:8080',
        TOPICS: {
            RELAY1: 'home/esp32/relay1',
            RELAY2: 'home/esp32/relay2',
            FEEDBACK1: 'home/esp32/feedback1',
            FEEDBACK2: 'home/esp32/feedback2',
            STATUS: 'home/esp32/status',
            ERROR: 'home/esp32/error'
        }
    },
    
    // ✅ THÊM WEBSOCKET CONFIG
    WEBSOCKET: {
        PORT: 81,
        RECONNECT_INTERVAL: 5000
    },
    
    // UI settings
    UI: {
        REFRESH_INTERVAL: 3000,
        TOAST_DURATION: 3000,
        SCAN_TIMEOUT: 5000
    },
    
    // Storage keys
    STORAGE: {
        ESP_IP: 'esp32_ip',
        LAST_CONNECT: 'esp32_last_connect'
    }
};

// ==================== APP STATE ====================
const AppState = {
    // Device info
    deviceIP: localStorage.getItem(CONFIG.STORAGE.ESP_IP) || null,
    connected: false,
    mqttConnected: false,
    wsConnected: false,
    
    // Relay states
    relay1: false,
    relay2: false,
    feedback1: false,
    feedback2: false,
    error: false,
    
    // Network
    rssi: 0,
    lastUpdate: null,
    
    // Diagnostic
    errorLogs: []
};

// ==================== UTILITIES ====================
const Utils = {
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.remove('hidden');
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, CONFIG.UI.TOAST_DURATION);
    },
    
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('vi-VN');
    },
    
    debounce(func, wait) {
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
