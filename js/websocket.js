// ==================== WEBSOCKET CLIENT ====================

class WebSocketClient {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.reconnectTimer = null;
        this.deviceIP = null;
    }
    
    // Connect to ESP32 WebSocket
    connect(ip) {
        if (!ip) {
            console.log('No IP address provided');
            return;
        }
        
        this.deviceIP = ip;
        
        try {
            this.ws = new WebSocket(`ws://${ip}:${CONFIG.WEBSOCKET.PORT}`);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.connected = true;
                AppState.wsConnected = true;
                updateConnectionStatus();
                Utils.showToast('✅ WebSocket connected', 'success');
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.connected = false;
                AppState.wsConnected = false;
                updateConnectionStatus();
                this.scheduleReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.connected = false;
                AppState.wsConnected = false;
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            
        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.scheduleReconnect();
        }
    }
    
    // Handle incoming messages
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            console.log('WebSocket received:', message);
            
            // Update state
            if (message.relay1 !== undefined) {
                AppState.relay1 = message.relay1;
                AppState.feedback1 = message.feedback1 !== undefined ? message.feedback1 : message.relay1;
            }
            
            if (message.relay2 !== undefined) {
                AppState.relay2 = message.relay2;
                AppState.feedback2 = message.feedback2 !== undefined ? message.feedback2 : message.relay2;
            }
            
            if (message.error !== undefined) {
                AppState.error = message.error;
            }
            
            // Update UI
            updateDeviceUI(1);
            updateDeviceUI(2);
            updateStats();
            updateDiagnostic();
            
        } catch (error) {
            console.error('Parse WebSocket message error:', error);
        }
    }
    
    // Send control command
    sendControl(relay, state) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            Utils.showToast('❌ WebSocket not connected', 'error');
            return false;
        }
        
        const command = {
            relay: relay,
            state: state,
            timestamp: Date.now()
        };
        
        this.ws.send(JSON.stringify(command));
        return true;
    }
    
    // Schedule reconnect
    scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            if (this.deviceIP) {
                console.log('Attempting WebSocket reconnect...');
                this.connect(this.deviceIP);
            }
        }, CONFIG.WEBSOCKET.RECONNECT_INTERVAL);
    }
    
    // Disconnect
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.connected = false;
            AppState.wsConnected = false;
        }
    }
}

// Initialize WebSocket client
const wsClient = new WebSocketClient();
