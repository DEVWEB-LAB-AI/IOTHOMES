// ==================== MAIN APPLICATION ====================
class App {
    constructor() {
        this.initialized = false;
        this.updateInterval = null;
        window.app = this; // Global access
    }
    
    // Initialize app
    async init() {
        if (this.initialized) return;
        
        console.log('🚀 ESP32-S3 Relay Controller v2.0');
        
        // Load saved IP
        const savedIP = localStorage.getItem(CONFIG.STORAGE.ESP_IP);
        if (savedIP) {
            API.setIP(savedIP);
            this.connectToDevice();
        } else {
            // Auto scan
            setTimeout(() => this.scanNetwork(), 1000);
        }
        
        // Start periodic updates
        this.startUpdates();
        
        this.initialized = true;
    }
    
    // Connect to device
    async connectToDevice() {
        try {
            await API.getStatus();
            this.updateUI();
            Utils.showToast('✅ Kết nối thành công', 'success');
        } catch (error) {
            console.log('Connection failed:', error);
            AppState.connected = false;
            this.updateConnectionUI();
        }
    }
    
    // Scan network
    async scanNetwork() {
        const ip = await Discovery.scanNetwork();
        
        if (ip) {
            API.setIP(ip);
            await this.connectToDevice();
        } else {
            Utils.showToast('❌ Không tìm thấy ESP32', 'error');
        }
    }
    
    // Manual IP
    setManualIP() {
        const ip = document.getElementById('manualIp').value.trim();
        if (!ip) {
            Utils.showToast('❌ Vui lòng nhập IP', 'error');
            return;
        }
        
        API.setIP(ip);
        this.connectToDevice();
    }
    
    // Control relay
    async controlRelay(relay, state) {
        if (!AppState.connected) {
            Utils.showToast('❌ Chưa kết nối ESP32', 'error');
            return;
        }
        
        try {
            await API.controlRelay(relay, state);
        } catch (error) {
            Utils.showToast('❌ Không thể điều khiển', 'error');
            AppState.connected = false;
            this.updateConnectionUI();
        }
    }
    
    // Run diagnostic
    async runDiagnostic() {
        if (!AppState.connected) {
            Utils.showToast('❌ Chưa kết nối ESP32', 'error');
            return;
        }
        
        Utils.showToast('🔍 Đang chẩn đoán...', 'info');
        
        try {
            const data = await API.runDiagnostic();
            this.displayDiagnostic(data);
            
            const hasError = !data.relay1?.match || !data.relay2?.match;
            Utils.showToast(
                hasError ? '⚠️ Phát hiện lỗi feedback' : '✅ Hệ thống OK',
                hasError ? 'warning' : 'success'
            );
            
        } catch (error) {
            Utils.showToast('❌ Chẩn đoán thất bại', 'error');
        }
    }
    
    // Refresh status
    async refreshStatus() {
        if (AppState.connected) {
            await this.connectToDevice();
        }
    }
    
    // Start periodic updates
    startUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            if (AppState.connected) {
                API.getStatus().then(() => this.updateUI()).catch(() => {});
            }
        }, CONFIG.UI.REFRESH_INTERVAL);
    }
    
    // Update UI
    updateUI() {
        this.updateConnectionUI();
        this.updateStatsUI();
        this.updateRelayUI();
    }
    
    // Update connection UI
    updateConnectionUI() {
        const led = document.getElementById('statusLed');
        const text = document.getElementById('statusText');
        const ipEl = document.getElementById('deviceIp');
        const wifiEl = document.getElementById('wifiStrength');
        
        if (AppState.connected) {
            led.className = 'status-led online';
            text.textContent = 'Đã kết nối';
            ipEl.textContent = AppState.deviceIP;
            
            // WiFi strength
            let wifiIcon = '📶';
            if (AppState.rssi > -50) wifiIcon = '📶';
            else if (AppState.rssi > -70) wifiIcon = '📶';
            else wifiIcon = '📶';
            wifiEl.textContent = `${wifiIcon} ${AppState.rssi}dBm`;
        } else {
            led.className = 'status-led offline';
            text.textContent = 'Mất kết nối';
            ipEl.textContent = '-';
            wifiEl.textContent = '📶 --';
        }
        
        // Stats
        document.getElementById('statConnection').textContent = 
            AppState.connected ? 'Online' : 'Offline';
        document.getElementById('statConnection').style.color = 
            AppState.connected ? 'var(--success)' : 'var(--danger)';
    }
    
    // Update stats UI
    updateStatsUI() {
        document.getElementById('statRelay1').textContent = 
            AppState.relay1 ? 'Bật' : 'Tắt';
        document.getElementById('statRelay2').textContent = 
            AppState.relay2 ? 'Bật' : 'Tắt';
        document.getElementById('statError').textContent = 
            AppState.error ? '1' : '0';
    }
    
    // Update relay UI
    updateRelayUI() {
        // Relay 1
        this.updateSingleRelay(1, AppState.relay1, AppState.feedback1);
        // Relay 2
        this.updateSingleRelay(2, AppState.relay2, AppState.feedback2);
    }
    
    updateSingleRelay(relay, output, feedback) {
        const match = output === feedback;
        
        // Output
        const outputEl = document.getElementById(`output${relay}`);
        outputEl.textContent = output ? 'ON' : 'OFF';
        outputEl.className = `tag ${output ? 'success' : 'danger'}`;
        
        // Feedback
        const fbEl = document.getElementById(`fb${relay}`);
        fbEl.textContent = feedback ? 'ON' : 'OFF';
        
        // Match
        const matchEl = document.getElementById(`match${relay}`);
        matchEl.textContent = match ? '✓' : '✗';
        matchEl.className = `tag match ${match ? '' : 'error'}`;
        
        // Bulb
        const bulb = document.getElementById(`bulb${relay}`);
        if (output) {
            bulb.classList.add('on');
            bulb.style.opacity = '1';
        } else {
            bulb.classList.remove('on');
            bulb.style.opacity = '0.5';
        }
        
        // Feedback badge
        const badge = document.getElementById(`feedback${relay}`);
        badge.className = `feedback-badge ${match ? 'ok' : 'error'}`;
    }
    
    // Display diagnostic
    displayDiagnostic(data) {
        const grid = document.getElementById('diagnosticGrid');
        
        grid.innerHTML = `
            <div class="diagnostic-item">
                <h4>Relay 1</h4>
                <div class="diagnostic-row ${data.relay1?.match ? 'success' : 'error'}">
                    <span>Output:</span>
                    <span>${data.relay1?.output ? 'ON' : 'OFF'}</span>
                </div>
                <div class="diagnostic-row">
                    <span>Feedback:</span>
                    <span>${data.relay1?.feedback ? 'ON' : 'OFF'}</span>
                </div>
                <div class="diagnostic-row">
                    <span>Match:</span>
                    <span>${data.relay1?.match ? '✓' : '✗'}</span>
                </div>
            </div>
            <div class="diagnostic-item">
                <h4>Relay 2</h4>
                <div class="diagnostic-row ${data.relay2?.match ? 'success' : 'error'}">
                    <span>Output:</span>
                    <span>${data.relay2?.output ? 'ON' : 'OFF'}</span>
                </div>
                <div class="diagnostic-row">
                    <span>Feedback:</span>
                    <span>${data.relay2?.feedback ? 'ON' : 'OFF'}</span>
                </div>
                <div class="diagnostic-row">
                    <span>Match:</span>
                    <span>${data.relay2?.match ? '✓' : '✗'}</span>
                </div>
            </div>
        `;
    }
}

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});
