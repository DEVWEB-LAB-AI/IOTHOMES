// ==================== KHỞI TẠO ỨNG DỤNG ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('ESP32-S3 Relay Controller initialized');
    
    // Initialize MQTT
    mqttClient.init();
    
    // Try to discover ESP32
    discoverESP32();
    
    // Start periodic updates
    startPeriodicUpdates();
    
    // Initialize charts
    initCharts();
    
    // Setup event listeners
    setupEventListeners();
});

// ==================== ESP32 DISCOVERY ====================

async function discoverESP32() {
    // Try to get from localStorage
    const savedIP = localStorage.getItem('esp32_ip');
    if (savedIP) {
        AppState.deviceIP = savedIP;
        wsClient.connect(savedIP);
        updateDeviceInfo();
        fetchStatus();
    }
    
    // Try mDNS
    try {
        const response = await fetch('http://esp32s3.local/api/status', {
            timeout: CONFIG.API.TIMEOUT
        });
        
        if (response.ok) {
            const data = await response.json();
            AppState.deviceIP = data.ip;
            localStorage.setItem('esp32_ip', data.ip);
            wsClient.connect(data.ip);
            updateDeviceInfo();
        }
    } catch (error) {
        console.log('mDNS discovery failed');
    }
}

// ==================== FETCH STATUS ====================

async function fetchStatus() {
    if (!AppState.deviceIP) return;
    
    try {
        const response = await fetch(`http://${AppState.deviceIP}/api/status`);
        
        if (response.ok) {
            const data = await response.json();
            
            AppState.relay1 = data.relay1;
            AppState.relay2 = data.relay2;
            AppState.feedback1 = data.feedback1;
            AppState.feedback2 = data.feedback2;
            AppState.error = data.error;
            AppState.lastUpdate = Date.now();
            
            updateDeviceUI(1);
            updateDeviceUI(2);
            updateStats();
            updateDiagnostic();
        }
    } catch (error) {
        console.log('Fetch status failed:', error);
    }
}

// ==================== CONTROL FUNCTIONS ====================

async function controlRelay(relay, state) {
    // Try WebSocket first
    if (wsClient.connected) {
        wsClient.sendControl(relay, state);
        return;
    }
    
    // Fallback to MQTT
    if (mqttClient.connected) {
        mqttClient.publishRelay(relay, state);
        return;
    }
    
    // Fallback to HTTP
    try {
        const response = await fetch(`http://${AppState.deviceIP}/api/control`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                relay: relay,
                state: state
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                Utils.showToast(`✅ Relay ${relay} ${state ? 'ON' : 'OFF'}`, 'success');
            }
        }
    } catch (error) {
        Utils.showToast('❌ Control failed', 'error');
    }
}

// ==================== DIAGNOSTIC FUNCTIONS ====================

async function runDiagnostic() {
    Utils.showToast('🔍 Running diagnostic...', 'info');
    
    if (!AppState.deviceIP) {
        Utils.showToast('❌ No device connected', 'error');
        return;
    }
    
    try {
        const response = await fetch(`http://${AppState.deviceIP}/api/diagnostic`);
        
        if (response.ok) {
            const data = await response.json();
            
            // Display diagnostic results
            displayDiagnosticResult(data);
            
            // Add to error log if mismatch
            if (!data.relay1.match) {
                addErrorLog({
                    errorCode: 1,
                    message: 'Relay 1 feedback mismatch',
                    timestamp: Date.now()
                });
            }
            
            if (!data.relay2.match) {
                addErrorLog({
                    errorCode: 2,
                    message: 'Relay 2 feedback mismatch',
                    timestamp: Date.now()
                });
            }
            
            Utils.showToast('✅ Diagnostic complete', 'success');
        }
    } catch (error) {
        Utils.showToast('❌ Diagnostic failed', 'error');
    }
}

function displayDiagnosticResult(data) {
    const panel = document.querySelector('.diagnostic-panel');
    
    // Create diagnostic report
    const report = document.createElement('div');
    report.className = 'diagnostic-report';
    report.innerHTML = `
        <h4>Diagnostic Report - ${Utils.formatTime(Date.now())}</h4>
        <div class="report-grid">
            <div class="report-item ${data.relay1.match ? 'success' : 'error'}">
                <span>Relay 1:</span>
                <span>Output: ${data.relay1.output ? 'ON' : 'OFF'}</span>
                <span>Feedback: ${data.relay1.feedback ? 'ON' : 'OFF'}</span>
                <span>Match: ${data.relay1.match ? '✓' : '✗'}</span>
            </div>
            <div class="report-item ${data.relay2.match ? 'success' : 'error'}">
                <span>Relay 2:</span>
                <span>Output: ${data.relay2.output ? 'ON' : 'OFF'}</span>
                <span>Feedback: ${data.relay2.feedback ? 'ON' : 'OFF'}</span>
                <span>Match: ${data.relay2.match ? '✓' : '✗'}</span>
            </div>
        </div>
    `;
    
    // Remove old report and add new one
    const oldReport = document.querySelector('.diagnostic-report');
    if (oldReport) oldReport.remove();
    panel.insertBefore(report, document.querySelector('.btn-diagnostic'));
}

// ==================== UI UPDATE FUNCTIONS ====================

function updateDeviceUI(relay) {
    if (relay === 1) {
        // Update output state
        const outputEl = document.getElementById('output1');
        outputEl.textContent = AppState.relay1 ? 'ON' : 'OFF';
        outputEl.className = `output-state ${AppState.relay1 ? 'on' : 'off'}`;
        
        // Update feedback state
        const fbEl = document.getElementById('fb1');
        fbEl.textContent = AppState.feedback1 ? 'ON' : 'OFF';
        fbEl.style.color = AppState.feedback1 ? '#4caf50' : '#f44336';
        
        // Update match indicator
        const match = AppState.relay1 === AppState.feedback1;
        const matchEl = document.getElementById('match1');
        matchEl.textContent = match ? '✓' : '✗';
        matchEl.className = `match-state ${match ? '' : 'error'}`;
        
        // Update feedback indicator
        const fbIndicator = document.getElementById('feedback1');
        fbIndicator.className = `feedback-indicator ${match ? 'ok' : 'error'}`;
        
        // Update power bar
        const powerBar = document.getElementById('power1');
        powerBar.style.width = AppState.relay1 ? '100%' : '0%';
        powerBar.style.background = AppState.relay1 ? 
            'linear-gradient(90deg, #4caf50, #8bc34a)' : 
            'linear-gradient(90deg, #f44336, #ff9800)';
            
    } else if (relay === 2) {
        // Update output state
        const outputEl = document.getElementById('output2');
        outputEl.textContent = AppState.relay2 ? 'ON' : 'OFF';
        outputEl.className = `output-state ${AppState.relay2 ? 'on' : 'off'}`;
        
        // Update feedback state
        const fbEl = document.getElementById('fb2');
        fbEl.textContent = AppState.feedback2 ? 'ON' : 'OFF';
        fbEl.style.color = AppState.feedback2 ? '#4caf50' : '#f44336';
        
        // Update match indicator
        const match = AppState.relay2 === AppState.feedback2;
        const matchEl = document.getElementById('match2');
        matchEl.textContent = match ? '✓' : '✗';
        matchEl.className = `match-state ${match ? '' : 'error'}`;
        
        // Update feedback indicator
        const fbIndicator = document.getElementById('feedback2');
        fbIndicator.className = `feedback-indicator ${match ? 'ok' : 'error'}`;
        
        // Update power bar
        const powerBar = document.getElementById('power2');
        powerBar.style.width = AppState.relay2 ? '100%' : '0%';
        powerBar.style.background = AppState.relay2 ? 
            'linear-gradient(90deg, #4caf50, #8bc34a)' : 
            'linear-gradient(90deg, #f44336, #ff9800)';
    }
}

function updateStats() {
    // Update connection stat
    const statConnection = document.getElementById('statConnection');
    statConnection.textContent = (AppState.mqttConnected || AppState.wsConnected) ? 'Online' : 'Offline';
    statConnection.style.color = (AppState.mqttConnected || AppState.wsConnected) ? '#4caf50' : '#f44336';
    
    // Update relay stats
    document.getElementById('statRelay1').textContent = AppState.relay1 ? 'Bật' : 'Tắt';
    document.getElementById('statRelay2').textContent = AppState.relay2 ? 'Bật' : 'Tắt';
    
    // Update error stat
    document.getElementById('statError').textContent = AppState.errorLogs.length;
}

function updateConnectionStatus() {
    const statusEl = document.getElementById('connectionStatus');
    const indicator = statusEl.querySelector('.status-indicator');
    const text = statusEl.querySelector('span');
    
    if (AppState.mqttConnected || AppState.wsConnected) {
        indicator.className = 'status-indicator online';
        text.textContent = 'Đã kết nối';
        
        // Show which connection
        if (AppState.wsConnected) {
            text.textContent += ' (WebSocket)';
        } else if (AppState.mqttConnected) {
            text.textContent += ' (MQTT)';
        }
    } else {
        indicator.className = 'status-indicator offline';
        text.textContent = 'Mất kết nối';
    }
}

function updateDeviceInfo() {
    if (AppState.deviceIP) {
        document.getElementById('deviceIP').textContent = `IP: ${AppState.deviceIP}`;
    }
}

function addErrorLog(error) {
    AppState.errorLogs.unshift({
        ...error,
        id: Utils.generateId()
    });
    
    // Keep only last 10 errors
    if (AppState.errorLogs.length > 10) {
        AppState.errorLogs.pop();
    }
    
    // Update error log UI
    const errorLogEl = document.getElementById('errorLog');
    errorLogEl.innerHTML = AppState.errorLogs.map(err => `
        <div class="error-entry">
            <span class="error-time">${Utils.formatTime(err.timestamp)}</span>
            <span class="error-code">[${err.errorCode}]</span>
            <span class="error-message">${err.message}</span>
        </div>
    `).join('');
}

function refreshStatus() {
    fetchStatus();
    Utils.showToast('🔄 Refreshing status...', 'info');
}

// ==================== CHARTS ====================

let charts = {};

function initCharts() {
    // Initialize feedback waveform charts
    const canvas1 = document.getElementById('graph1');
    const canvas2 = document.getElementById('graph2');
    
    if (canvas1) {
        charts.graph1 = new Chart(canvas1.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Feedback 1',
                    data: [],
                    borderColor: '#4caf50',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1
                    }
                }
            }
        });
    }
    
    if (canvas2) {
        charts.graph2 = new Chart(canvas2.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Feedback 2',
                    data: [],
                    borderColor: '#2196f3',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1
                    }
                }
            }
        });
    }
}

function updateCharts() {
    // Add new feedback values
    AppState.feedbackHistory1.push(AppState.feedback1 ? 1 : 0);
    AppState.feedbackHistory2.push(AppState.feedback2 ? 1 : 0);
    
    // Keep only last 50 samples
    if (AppState.feedbackHistory1.length > 50) {
        AppState.feedbackHistory1.shift();
        AppState.feedbackHistory2.shift();
    }
    
    // Update chart data
    if (charts.graph1) {
        charts.graph1.data.labels = Array.from({length: AppState.feedbackHistory1.length}, (_, i) => i);
        charts.graph1.data.datasets[0].data = AppState.feedbackHistory1;
        charts.graph1.update();
    }
    
    if (charts.graph2) {
        charts.graph2.data.labels = Array.from({length: AppState.feedbackHistory2.length}, (_, i) => i);
        charts.graph2.data.datasets[0].data = AppState.feedbackHistory2;
        charts.graph2.update();
    }
}

// ==================== PERIODIC UPDATES ====================

function startPeriodicUpdates() {
    // Update status every 2 seconds
    setInterval(() => {
        if (AppState.deviceIP) {
            fetchStatus();
        }
    }, CONFIG.UI.REFRESH_INTERVAL);
    
    // Update charts every 500ms
    setInterval(() => {
        updateCharts();
    }, 500);
    
    // Update diagnostic display
    setInterval(() => {
        updateDiagnostic();
    }, 1000);
}

function updateDiagnostic() {
    // Update waveform indicators
    const waveform1 = document.getElementById('waveform1');
    const waveform2 = document.getElementById('waveform2');
    
    if (waveform1) {
        const match = AppState.relay1 === AppState.feedback1;
        waveform1.innerHTML = `<div class="signal ${match ? 'good' : 'bad'}">
            ${match ? '✓ Feedback OK' : '✗ Feedback Error'}
        </div>`;
    }
    
    if (waveform2) {
        const match = AppState.relay2 === AppState.feedback2;
        waveform2.innerHTML = `<div class="signal ${match ? 'good' : 'bad'}">
            ${match ? '✓ Feedback OK' : '✗ Feedback Error'}
        </div>`;
    }
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    // Manual IP input
    const ipInput = document.createElement('div');
    ipInput.className = 'ip-input-container';
    ipInput.innerHTML = `
        <input type="text" id="manualIP" placeholder="192.168.1.xxx">
        <button onclick="setManualIP()">Connect</button>
    `;
    document.querySelector('.device-info').appendChild(ipInput);
}

function setManualIP() {
    const ip = document.getElementById('manualIP').value;
    if (ip) {
        AppState.deviceIP = ip;
        localStorage.setItem('esp32_ip', ip);
        wsClient.connect(ip);
        updateDeviceInfo();
        fetchStatus();
        Utils.showToast(`🔌 Connecting to ${ip}...`, 'info');
    }
}

// ==================== EXPORT GLOBAL FUNCTIONS ====================

window.controlRelay = controlRelay;
window.runDiagnostic = runDiagnostic;
window.refreshStatus = refreshStatus;
window.setManualIP = setManualIP;
