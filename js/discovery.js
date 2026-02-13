// ==================== ESP32 DISCOVERY ====================
class ESP32Discovery {
    constructor() {
        this.isScanning = false;
        this.foundIPs = new Set();
        this.onDeviceFound = null;
    }
    
    // Start network scan
    async scanNetwork() {
        if (this.isScanning) return;
        
        this.isScanning = true;
        this.foundIPs.clear();
        
        Utils.showToast('🔍 Đang quét mạng...', 'info');
        
        // Try 1: Saved IP
        const savedIP = localStorage.getItem(CONFIG.STORAGE.ESP_IP);
        if (savedIP && await this.testDevice(savedIP)) {
            this.isScanning = false;
            return savedIP;
        }
        
        // Try 2: mDNS
        try {
            const mdnsIP = await this.testMDNS();
            if (mdnsIP) {
                this.isScanning = false;
                return mdnsIP;
            }
        } catch (e) {}
        
        // Try 3: Broadcast
        const broadcastIP = await this.scanBroadcast();
        if (broadcastIP) {
            this.isScanning = false;
            return broadcastIP;
        }
        
        // Try 4: Common IPs
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
    async testDevice(ip, timeout = CONFIG.DISCOVERY.TIMEOUT) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(`http://${ip}${CONFIG.API.DISCOVERY}`, {
                signal: controller.signal
            });
            
            clearTimeout(id);
            
            if (response.ok) {
                const data = await response.json();
                if (data.name?.includes('ESP32') || data.ip) {
                    console.log(`✅ Found ESP32 at ${ip}`);
                    return ip;
                }
            }
        } catch (e) {}
        return null;
    }
    
    // Test mDNS
    async testMDNS() {
        return await this.testDevice(CONFIG.DISCOVERY.MDNS_HOST, 2000);
    }
    
    // Scan broadcast
    async scanBroadcast() {
        // Get local IP
        const localIP = await this.getLocalIP();
        if (!localIP) return null;
        
        const baseIP = localIP.substring(0, localIP.lastIndexOf('.') + 1);
        
        // Scan common IPs first (1-20, 100-120, 200-254)
        const commonRanges = [
            ...Array.from({length: 20}, (_, i) => i + 1),
            ...Array.from({length: 20}, (_, i) => i + 100),
            ...Array.from({length: 55}, (_, i) => i + 200)
        ];
        
        for (const last of commonRanges) {
            const ip = `${baseIP}${last}`;
            const found = await this.testDevice(ip, 300);
            if (found) return found;
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
    
    // Get local IP
    async getLocalIP() {
        try {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('');
            
            const promise = new Promise(resolve => {
                pc.onicecandidate = (e) => {
                    if (e.candidate) {
                        const ip = e.candidate.address || e.candidate.ip;
                        if (ip && ip.includes('.')) {
                            pc.close();
                            resolve(ip);
                        }
                    }
                };
            });
            
            await pc.createOffer().then(d => pc.setLocalDescription(d));
            const ip = await promise;
            return ip;
        } catch (e) {
            return null;
        }
    }
}

// Export singleton
const Discovery = new ESP32Discovery();
