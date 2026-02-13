// ==================== ESP32 DISCOVERY ====================
class ESP32Discovery {
    constructor() {
        this.isScanning = false;
        this.foundIPs = new Set();
        this.onDeviceFound = null;
    }
    
    // Start network scan
    async scanNetwork() {
        if (this.isScanning) return null;
        
        this.isScanning = true;
        this.foundIPs.clear();
        
        Utils.showToast('🔍 Đang quét mạng...', 'info');
        
        // Try 1: Saved IP
        const savedIP = localStorage.getItem(CONFIG.STORAGE.ESP_IP);
        if (savedIP) {
            const found = await this.testDevice(savedIP);
            if (found) {
                this.isScanning = false;
                return savedIP;
            }
        }
        
        // Try 2: Common IPs
        const commonIP = await this.scanCommonIPs();
        if (commonIP) {
            this.isScanning = false;
            return commonIP;
        }
        
        Utils.showToast('❌ Không tìm thấy ESP32', 'error');
        this.isScanning = false;
        return null;
    }
    
    // Test single device
    async testDevice(ip, timeout = 1000) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(`http://${ip}${CONFIG.API.DISCOVERY}`, {
                signal: controller.signal,
                mode: 'cors',
                cache: 'no-cache'
            });
            
            clearTimeout(id);
            
            if (response.ok) {
                console.log(`✅ Found ESP32 at ${ip}`);
                return ip;
            }
        } catch (e) {
            // Silent fail
        }
        return null;
    }
    
    // Scan common IPs
    async scanCommonIPs() {
        const commonIPs = [
            '192.168.1.100', '192.168.1.101', '192.168.1.102',
            '192.168.0.100', '192.168.0.101', '192.168.0.102',
            '192.168.4.1', '10.0.0.100', '172.16.0.100'
        ];
        
        for (const ip of commonIPs) {
            const found = await this.testDevice(ip, 500);
            if (found) return found;
        }
        
        return null;
    }
}

// Export singleton
const Discovery = new ESP32Discovery();
