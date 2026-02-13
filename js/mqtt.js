// ==================== MQTT CLIENT ====================

class MQTTClient {
    constructor() {
        this.client = null;
        this.connected = false;
        this.reconnectTimer = null;
    }
    
    // Initialize MQTT connection
    init() {
        try {
            this.client = mqtt.connect(CONFIG.MQTT.BROKER);
            
            this.client.on('connect', () => {
                console.log('MQTT connected');
                this.connected = true;
                AppState.mqttConnected = true;
                
                // Subscribe to topics
                this.subscribe();
                
                // Update UI
                updateConnectionStatus();
                Utils.showToast('✅ MQTT connected', 'success');
            });
            
            this.client.on('message', (topic, message) => {
                this.handleMessage(topic, message.toString());
            });
            
            this.client.on('error', (error) => {
                console.error('MQTT error:', error);
                this.connected = false;
                AppState.mqttConnected = false;
                Utils.showToast('❌ MQTT error', 'error');
            });
            
            this.client.on('close', () => {
                console.log('MQTT disconnected');
                this.connected = false;
                AppState.mqttConnected = false;
                updateConnectionStatus();
                this.scheduleReconnect();
            });
            
        } catch (error) {
            console.error('MQTT init error:', error);
            this.scheduleReconnect();
        }
    }
    
    // Subscribe to topics
    subscribe() {
        if (this.client && this.connected) {
            this.client.subscribe(CONFIG.MQTT.TOPICS.FEEDBACK1);
            this.client.subscribe(CONFIG.MQTT.TOPICS.FEEDBACK2);
            this.client.subscribe(CONFIG.MQTT.TOPICS.STATUS);
            this.client.subscribe(CONFIG.MQTT.TOPICS.ERROR);
        }
    }
    
    // Handle incoming messages
    handleMessage(topic, message) {
        console.log(`MQTT received: ${topic} - ${message}`);
        
        try {
            const data = JSON.parse(message);
            
            switch(topic) {
                case CONFIG.MQTT.TOPICS.FEEDBACK1:
                    AppState.feedback1 = data.state === true || data.state === 'ON' || data.state === 1;
                    AppState.relay1 = AppState.feedback1;
                    updateDeviceUI(1);
                    break;
                    
                case CONFIG.MQTT.TOPICS.FEEDBACK2:
                    AppState.feedback2 = data.state === true || data.state === 'ON' || data.state === 1;
                    AppState.relay2 = AppState.feedback2;
                    updateDeviceUI(2);
                    break;
                    
                case CONFIG.MQTT.TOPICS.STATUS:
                    if (data.ip) AppState.deviceIP = data.ip;
                    updateDeviceInfo();
                    break;
                    
                case CONFIG.MQTT.TOPICS.ERROR:
                    AppState.error = true;
                    addErrorLog(data);
                    updateDiagnostic();
                    Utils.showToast('⚠️ Device error detected', 'warning');
                    break;
            }
            
            updateStats();
            
        } catch (error) {
            console.error('Parse message error:', error);
        }
    }
    
    // Publish control command
    publishRelay(relay, state) {
        if (!this.client || !this.connected) {
            Utils.showToast('❌ MQTT not connected', 'error');
            return false;
        }
        
        const topic = relay === 1 ? CONFIG.MQTT.TOPICS.RELAY1 : CONFIG.MQTT.TOPICS.RELAY2;
        const payload = state ? 'ON' : 'OFF';
        
        this.client.publish(topic, payload);
        Utils.showToast(`📤 Sent: Relay ${relay} ${payload}`, 'info');
        return true;
    }
    
    // Schedule reconnect
    scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            console.log('Attempting MQTT reconnect...');
            this.init();
        }, 5000);
    }
    
    // Disconnect
    disconnect() {
        if (this.client) {
            this.client.end();
            this.connected = false;
            AppState.mqttConnected = false;
        }
    }
}

// Initialize MQTT client
const mqttClient = new MQTTClient();
