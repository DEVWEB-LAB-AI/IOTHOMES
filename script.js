let espIP = localStorage.getItem('esp_ip') || '';
let authToken = localStorage.getItem('auth_token');
let isConnected = false;

// Kiểm tra đăng nhập
if (!authToken && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
}

// TÌM ESP32 TỰ ĐỘNG
async function scanESP32() {
    addLog('🔍 Đang tìm ESP32 trong mạng...');
    
    // Thử các IP phổ biến
    const commonIPs = [
        '192.168.1.100',
        '192.168.1.101',
        '192.168.0.100',
        '192.168.1.2',
        '192.168.0.2',
        '10.0.0.100'
    ];
    
    for (let ip of commonIPs) {
        try {
            addLog(`📡 Thử kết nối ${ip}...`);
            const response = await fetch(`http://${ip}/status`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
                timeout: 1000
            });
            
            if (response.ok) {
                espIP = ip;
                localStorage.setItem('esp_ip', ip);
                document.getElementById('esp-ip').value = ip;
                addLog(`✅ Tìm thấy ESP32 tại ${ip}`);
                updateStatus();
                return true;
            }
        } catch (e) {
            // Không kết nối được
        }
    }
    
    addLog('❌ Không tìm thấy ESP32! Kiểm tra IP thủ công.');
    return false;
}

// Lưu IP
function saveIP() {
    const ipInput = document.getElementById('esp-ip');
    espIP = ipInput.value;
    localStorage.setItem('esp_ip', espIP);
    addLog(`✅ Đã lưu IP: ${espIP}`);
    updateStatus();
}

// Điều khiển relay
async function controlRelay(relay, state) {
    if (!espIP) {
        addLog('❌ Chưa có IP! Vui lòng nhập IP ESP32');
        await scanESP32();
        if (!espIP) return;
    }
    
    try {
        const url = `http://${espIP}/control?relay=${relay}&state=${state}`;
        addLog(`🔄 Điều khiển Relay ${relay}: ${state ? 'BẬT' : 'TẮT'}`);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.status === 401) {
            addLog('❌ Sai mật khẩu! Đăng nhập lại.');
            logout();
            return;
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
            updateRelayUI(relay, state);
            updateFeedbackUI(data.feedback1, data.feedback2);
            addLog(`✅ Relay ${relay} ${state ? 'BẬT' : 'TẮT'} thành công`);
            
            // Kiểm tra feedback
            if (relay === 1 && data.feedback1 != state) {
                addLog('⚠️ CẢNH BÁO: Feedback Relay 1 không khớp!');
            }
            if (relay === 2 && data.feedback2 != state) {
                addLog('⚠️ CẢNH BÁO: Feedback Relay 2 không khớp!');
            }
        }
    } catch (error) {
        addLog(`❌ Lỗi: ${error.message}`);
        document.getElementById('connection-status').className = 'status offline';
        document.getElementById('connection-status').textContent = '🔴 Mất kết nối';
        
        // Tự động tìm lại
        setTimeout(scanESP32, 3000);
    }
}

// Lấy trạng thái
async function updateStatus() {
    if (!espIP) {
        await scanESP32();
        return;
    }
    
    try {
        const url = `http://${espIP}/status`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            timeout: 2000
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        
        const data = await response.json();
        
        updateRelayUI(1, data.relay1);
        updateRelayUI(2, data.relay2);
        updateFeedbackUI(data.feedback1, data.feedback2);
        
        document.getElementById('connection-status').className = 'status online';
        document.getElementById('connection-status').textContent = '🟢 Kết nối thành công';
        document.getElementById('wifi-info').innerHTML = `📡 ${data.wifi_ssid || 'ESP32'} | IP: ${espIP}`;
        
        isConnected = true;
        
    } catch (error) {
        console.log('Lỗi kết nối:', error);
        document.getElementById('connection-status').className = 'status offline';
        document.getElementById('connection-status').textContent = '🔴 Mất kết nối';
        isConnected = false;
    }
}

// Thêm log
function addLog(message) {
    const logDiv = document.getElementById('log-messages');
    if (!logDiv) return;
    
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const time = new Date().toLocaleTimeString('vi-VN');
    entry.innerHTML = `<span style="color: #666;">[${time}]</span> ${message}`;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
    
    while (logDiv.children.length > 15) {
        logDiv.removeChild(logDiv.firstChild);
    }
}

// Update UI
function updateRelayUI(relay, state) {
    const statusElement = document.getElementById(`relay${relay}-status`);
    if (statusElement) {
        if (state) {
            statusElement.innerHTML = '🟢 BẬT';
            statusElement.style.color = '#4CAF50';
        } else {
            statusElement.innerHTML = '⚫ TẮT';
            statusElement.style.color = '#333';
        }
    }
}

function updateFeedbackUI(fb1, fb2) {
    const f1 = document.getElementById('feedback1');
    const f2 = document.getElementById('feedback2');
    if (f1) f1.textContent = fb1;
    if (f2) f2.textContent = fb2;
}

// Đăng xuất
function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('esp_ip');
    window.location.href = 'login.html';
}

// Khởi tạo
window.onload = async () => {
    const ipInput = document.getElementById('esp-ip');
    if (ipInput) ipInput.value = espIP;
    
    addLog('🚀 Hệ thống sẵn sàng');
    
    if (!espIP) {
        await scanESP32();
    } else {
        updateStatus();
    }
    
    // Cập nhật mỗi 3 giây
    setInterval(updateStatus, 3000);
};
