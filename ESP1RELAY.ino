#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>

// Thông tin WiFi
const char* ssid = "MAI HIEP";
const char* password = "15081983";

// THÔNG TIN HIVEMQ CLOUD (ĐÃ ĐÚNG)
const char* mqtt_server = "f70a09e2678a4ee9bd009145291314c2.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "esp32_supermini_control";
const char* mqtt_password = "Esp32@Control2024!";

// Định nghĩa chân LED cho ESP32-S3 Supermini
#define LED_OUTPUT_1 5
#define LED_OUTPUT_2 6

// Topics MQTT
const char* topic_subscribe = "esp32/control";
const char* topic_publish = "esp32/status";

WiFiClientSecure espClient;
PubSubClient client(espClient);

bool relayState = false;
unsigned long lastMsg = 0;
const long interval = 30000;
int reconnectAttempts = 0;

void setup_wifi() {
  Serial.print("📶 Đang kết nối WiFi: ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi đã kết nối!");
    Serial.print("📡 IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("📶 RSSI: ");
    Serial.println(WiFi.RSSI());
  } else {
    Serial.println("\n❌ Kết nối WiFi thất bại!");
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("📩 Nhận [");
  Serial.print(topic);
  Serial.print("]: ");
  
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);
  
  if (message == "ON") {
    relayState = true;
    digitalWrite(LED_OUTPUT_1, HIGH);
    digitalWrite(LED_OUTPUT_2, HIGH);
    Serial.println("🔴 Đã BẬT LED");
    client.publish(topic_publish, "ON");
  }
  else if (message == "OFF") {
    relayState = false;
    digitalWrite(LED_OUTPUT_1, LOW);
    digitalWrite(LED_OUTPUT_2, LOW);
    Serial.println("⚫ Đã TẮT LED");
    client.publish(topic_publish, "OFF");
  }
  else if (message == "STATUS") {
    String status = relayState ? "ON" : "OFF";
    client.publish(topic_publish, status.c_str());
    Serial.println("📊 Đã gửi trạng thái: " + status);
  }
}

void reconnect() {
  reconnectAttempts = 0;
  
  while (!client.connected() && reconnectAttempts < 5) {
    Serial.println("\n🔄 Đang kết nối MQTT...");
    Serial.print("   Server: ");
    Serial.println(mqtt_server);
    Serial.print("   User: ");
    Serial.println(mqtt_user);
    
    String clientId = "ESP32S3-" + String(random(0xffff), HEX);
    
    // QUAN TRỌNG: Bỏ qua kiểm tra certificate
    espClient.setInsecure();
    
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_password)) {
      Serial.println("✅ KẾT NỐI MQTT THÀNH CÔNG!");
      
      if (client.subscribe(topic_subscribe)) {
        Serial.print("📥 Subscribed: ");
        Serial.println(topic_subscribe);
      }
      
      // Gửi ONLINE để báo web biết ESP32 đã sẵn sàng
      if (client.publish(topic_publish, "ONLINE")) {
        Serial.println("📤 Đã gửi ONLINE");
      }
      
      reconnectAttempts = 0;
      return;
    } else {
      Serial.print("❌ THẤT BẠI! Mã lỗi: ");
      Serial.println(client.state());
      
      // Giải thích lỗi
      switch(client.state()) {
        case -4: Serial.println("   -> Timeout - Kiểm tra lại URL và port"); break;
        case -3: Serial.println("   -> Mất kết nối - Thử lại"); break;
        case -2: Serial.println("   -> Kết nối thất bại - Kiểm tra mạng"); break;
        case -1: Serial.println("   -> Disconnected - Đang thử lại"); break;
        case 1: Serial.println("   -> Sai protocol - Không đúng"); break;
        case 2: Serial.println("   -> Sai Client ID - Thử lại"); break;
        case 3: Serial.println("   -> Server unavailable - HiveMQ lỗi?"); break;
        case 4: Serial.println("   -> SAI USERNAME/PASSWORD - Kiểm tra lại!"); break;
        case 5: Serial.println("   -> Unauthorized - Không được phép"); break;
        default: Serial.println("   -> Lỗi không xác định");
      }
      
      reconnectAttempts++;
      Serial.print("⏳ Thử lại lần ");
      Serial.print(reconnectAttempts);
      Serial.println("/5 sau 5 giây...");
      delay(5000);
    }
  }
  
  if (!client.connected()) {
    Serial.println("\n❌ KHÔNG THỂ KẾT NỐI MQTT SAU 5 LẦN THỬ!");
    Serial.println("📝 KIỂM TRA LẠI:");
    Serial.println("   1. Username và password đã đúng chưa?");
    Serial.println("   2. Đã tạo user trong HiveMQ Cloud chưa?");
    Serial.println("   3. Cluster URL có chính xác không?");
    Serial.println("   4. ESP32-S3 đã có Internet chưa?");
    
    // Restart ESP32 để thử lại từ đầu
    Serial.println("🔄 Khởi động lại ESP32 sau 10 giây...");
    delay(10000);
    ESP.restart();
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n=================================");
  Serial.println("🚀 ESP32-S3 + HiveMQ Cloud");
  Serial.println("=================================");
  
  // Khởi tạo GPIO
  pinMode(LED_OUTPUT_1, OUTPUT);
  pinMode(LED_OUTPUT_2, OUTPUT);
  digitalWrite(LED_OUTPUT_1, LOW);
  digitalWrite(LED_OUTPUT_2, LOW);
  Serial.println("✅ Đã khởi tạo GPIO 5,6");
  
  // Kết nối WiFi
  setup_wifi();
  
  // Cấu hình MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  client.setKeepAlive(60);
  client.setSocketTimeout(10);
  
  Serial.println("\n📡 Thông tin kết nối MQTT:");
  Serial.println("   Server: " + String(mqtt_server));
  Serial.println("   Port: " + String(mqtt_port));
  Serial.println("   User: " + String(mqtt_user));
  Serial.println("   Control topic: " + String(topic_subscribe));
  Serial.println("   Status topic: " + String(topic_publish));
  Serial.println("=================================\n");
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  unsigned long now = millis();
  if (now - lastMsg > interval) {
    lastMsg = now;
    if (client.connected()) {
      client.publish(topic_publish, "HEARTBEAT");
      Serial.println("💓 Heartbeat");
    }
  }
  
  delay(10);
}
