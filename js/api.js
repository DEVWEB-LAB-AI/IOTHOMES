// ==================== ESP32 API CLIENT ====================
class ESP32API {
    constructor() {
        this.baseURL = null;
        this.retryCount = 0;
        this.maxRetries = 3;
    }
    
    // Set device IP
    setIP(ip) {
        this.baseURL = `http://${ip}`;
        AppState.deviceIP = ip;
        localStorage.setItem(CONFIG.STORAGE.ESP_IP, ip);
        localStorage.setItem(CONFIG.STORAGE.LAST_CONNECT, Date.now());
        
        // Update UI
        document.getElementById('deviceIp').textContent = ip;
        document.getElementById('manualIp').value = ip;
    }
    
    // Clear connection
    clearIP() {
        this.baseURL = null;
        AppState.deviceIP = null;
        AppState.connected = false;
        localStorage.removeItem(CONFIG.STORAGE.ESP_IP);
    }
    
    // Make request
    async request(endpoint, options = {}) {
        if (!this.baseURL) {
            throw new Error('No device connected');
        }
        
        const url = `${this.baseURL}${endpoint}`;
        const defaultOptions = {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
        };
        
        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            
            // Retry logic
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                await this.delay(1000 * this.retryCount);
                return this.request(endpoint, options);
            }
            
            this.retryCount = 0;
            throw error;
        }
    }
    
    // Get status
    async getStatus() {
        try {
            const data = await this.request(CONFIG.API.STATUS);
            
            AppState.relay1 = data.relay1 || false;
            AppState.relay2 = data.relay2 || false;
            AppState.feedback1 = data.feedback1 || false;
            AppState.feedback2 = data.feedback2 || false;
            AppState.error = data.error || false;
            AppState.rssi = data.rssi || 0;
            AppState.connected = true;
            AppState.lastUpdate = Date.now();
            
            return data;
            
        } catch (error) {
            AppState.connected = false;
            throw error;
        }
    }
    
    // Control relay
    async controlRelay(relay, state) {
        const data = await this.request(CONFIG.API.CONTROL, {
            method: 'POST',
            body: JSON.stringify({ relay, state })
        });
        
        if (data.success) {
            await this.getStatus();
            Utils.showToast(`✅ Relay ${relay} ${state ? 'ON' : 'OFF'}`, 'success');
        }
        
        return data;
    }
    
    // Run diagnostic
    async runDiagnostic() {
        return await this.request(CONFIG.API.DIAGNOSTIC);
    }
    
    // Delay helper
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton
const API = new ESP32API();
