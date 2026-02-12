let espIP = localStorage.getItem('esp_ip') || '192.168.1.100';
let authToken = localStorage.getItem('auth_token');

// Kiểm tra đăng nhập
if (!authToken && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
}

// Lưu IP
function saveIP() {
    const ipInput = document.getElementById('esp-ip');
    espIP = ipInput.value;
    localStorage.setItem('esp_ip', espIP);
    addLog(`✅ Đã lưu địa chỉ IP: ${espIP}`);
    updateStatus();
}

// Điều khiển relay
async function controlRelay(relay, state) {
    if (!espIP) {
        alert('❌ Vui lòng cấu hình IP ESP32!');
        return;
    }
    
    try {
        const url = `http://${espIP}/control?relay=${relay}&state=${state}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.status === 401) {
            alert('❌ Không có quyền truy cập!');
            logout();
            return;
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
            updateRelayUI(relay, state);
            updateFeedbackUI(data.feedback1, data.feedback2);
            addLog(`✅ Relay ${relay}: ${state ? 'BẬT' : 'TẮT'}`);
            
            // Kiểm tra feedback có khớp không
            checkFeedback(relay, state, data);
        }
    } catch (error) {
        console.error('Lỗi:', error);
        addLog(`❌ Lỗi điều khiển relay ${relay}: ${error.message}`);
        document.getElementById('connection-status').className = 'status offline';
        document.getElementById('connection-status').textContent = '🔴 Mất kết nối';
    }
}

// Cập nhật UI relay
function updateRelayUI(relay, state) {
    const statusElement = document.getElementById(`relay${relay}-status`);
    if (state) {
        statusElement.innerHTML = '🟢 BẬT';
        statusElement.style.color = '#4CAF50';
    } else {
        statusElement.innerHTML = '⚫ TẮT';
        statusElement.style.color = '#333';
    }
}

// Cập nhật feedback
function updateFeedbackUI(fb1, fb2) {
    document.getElementById('feedback1').textContent = fb1;
    document.getElementById('feedback2').textContent = fb2;
}

// Kiểm tra feedback
function checkFeedback(relay, state, data) {
    let feedback;
    if (relay === 1) feedback = data.feedback1;
    else feedback = data.feedback2;
    
    // Giả sử relay active HIGH, feedback cũng HIGH khi relay ON
    if ((state && feedback != 1) || (!state && feedback != 0)) {
        addLog(`⚠️ CẢNH BÁO: Feedback relay ${relay} không khớp!`);
    }
}

// Lấy trạng thái hiện tại
async function updateStatus() {
    if (!espIP || !authToken) return;
    
    try {
        const url = `http://${espIP}/status`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        const data = await response.json();
        
        updateRelayUI(1, data.relay1);
        updateRelayUI(2, data.relay2);
        updateFeedbackUI(data.feedback1, data.feedback2);
        
        document.getElementById('connection-status').className = 'status online';
        document.getElementById('connection-status').textContent = '🟢 Kết nối thành công';
        document.getElementById('wifi-info').innerHTML = `📡 ${data.wifi_ssid} | IP: ${data.ip}`;
        
    } catch (error) {
        console.log('Không thể kết nối ESP32:', error);
        document.getElementById('connection-status').className = 'status offline';
        document.getElementById('connection-status').textContent = '🔴 Mất kết nối';
    }
}

// Thêm log
function addLog(message) {
    const logDiv = document.getElementById('log-messages');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    const time = new Date().toLocaleTimeString('vi-VN');
    entry.innerHTML = `<span style="color: #666;">[${time}]</span> ${message}`;
    
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
    
    // Giới hạn số lượng log
    while (logDiv.children.length > 20) {
        logDiv.removeChild(logDiv.firstChild);
    }
}

// Đăng xuất
function logout() {
    localStorage.removeItem('auth_token');
    window.location.href = 'login.html';
}

// Cập nhật trạng thái mỗi 5 giây
setInterval(updateStatus, 5000);

// Cập nhật ngay khi tải trang
window.onload = () => {
    document.getElementById('esp-ip').value = espIP;
    updateStatus();
    addLog('🚀 Hệ thống sẵn sàng');
};
