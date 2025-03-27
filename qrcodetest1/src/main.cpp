#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32QRCodeReader.h>
#include "esp_camera.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFiMulti.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 32
#define OLED_RESET -1
#define RELAY_PIN 13
#define BUZZER_PIN 2 // Passive buzzer connected to GPIO12

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
WiFiMulti wifiMulti;

const String scannerIdTimeIn = "room_1_esp32cam_2";  // For time-in scans
const String scannerIdTimeOut = "room_1_esp32cam_2"; // For time-out scans (or any other value)

const char *apiUrl = "YOUR API URL HERE";

// Define QR code reader, time offsets, etc.
ESP32QRCodeReader reader(CAMERA_MODEL_AI_THINKER);
const long gmtOffsetSec = 8 * 3600;
const int daylightOffsetSec = 0;

// Global variables for active class information
String activeClassId = "";
String activeClassName = "";
bool activeClassFound = false;
volatile bool scanningEnabled = true; // Global flag to control scanning
String lastActiveClassId = "";

// Forward declarations for functions
void getClassData();
void processClassData(const String &payload);
String getCurrentDay();
void markAttendance(const String &userId, const String &classId);
void onQrCodeTask(void *pvParameters);
bool isUserEnrolledInClass(const String &userId, const String &classId);
String encodeURIComponent(String str);
String getFormattedTime();
void updateOLED(const String &displayText);
void updateOLEDMessage(const String &message);
String getUserFullName(const String &userId);
// New forward declarations for timeout functions
void updateTimeoutForClass(const String &userId, const String &classId);
void updateAllTimeouts(const String &userId, const String &currentActiveClassId = "");

// Function to play a tone using LEDC PWM for the passive buzzer
void playTone(uint32_t frequency, uint32_t duration)
{
  const int ledChannel = 0; // LEDC channel 0
  const int resolution = 8; // 8-bit resolution (0-255)

  // Configure LEDC on the specified channel
  ledcSetup(ledChannel, frequency, resolution);
  ledcAttachPin(BUZZER_PIN, ledChannel);

  // Set duty cycle to 50% (128 out of 255) to generate an audible tone
  ledcWrite(ledChannel, 128);
  delay(duration);

  // Stop the tone by setting duty cycle to 0 and detach the pin
  ledcWrite(ledChannel, 0);
  ledcDetachPin(BUZZER_PIN);
}
String decodeHex(const String &hexStr)
{
  String decoded;
  decoded.reserve(hexStr.length() / 2); // Reserve enough space to avoid repeated memory allocations

  for (int i = 0; i < hexStr.length(); i += 2)
  {
    // Extract two characters (one byte) at a time
    String byteString = hexStr.substring(i, i + 2);
    // Convert that two-char hex string to a number
    char c = (char)strtol(byteString.c_str(), nullptr, 16);
    decoded += c;
  }
  return decoded;
}
void setup()
{
  delay(2000); // Allow time for initialization
  Serial.begin(115200);
  delay(500);

  Serial.println("Starting Passive Buzzer Test...");
  for (int i = 0; i < 3; i++)
  {
    Serial.println("Playing tone " + String(i + 1));
    playTone(2000, 500);
    delay(300);
  }
  Serial.println("Buzzer Test Complete.");

  // Initialize OLED
  Wire.begin(14, 15); // SDA -> GPIO14, SCL -> GPIO15
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C))
  {
    Serial.println(F("OLED initialization failed"));
    while (true)
      ;
  }
  display.clearDisplay();
  display.setRotation(0);
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // Initialize relay and test it
  pinMode(RELAY_PIN, OUTPUT);
  Serial.println("Testing Relay...");
  digitalWrite(RELAY_PIN, LOW); // Adjust if module is active LOW
  display.println("Relay ON");
  display.display();
  delay(5000);
  digitalWrite(RELAY_PIN, HIGH);
  Serial.println("Relay Test Complete.");
  display.println("Relay OFF");
  display.display();

  // Connect to WiFi using WiFiMulti
  wifiMulti.addAP("Oo", "Cyclone1");
  wifiMulti.addAP("HUAWEI-2.4G-4uG9", "qZnbt34c");

  Serial.print("Connecting to WiFi");
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Offline");
  display.display();
  while (wifiMulti.run() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("WiFi Connected!");
  display.println("SSID: " + String(WiFi.SSID()));
  display.display();
  delay(1000);

  // Configure time for Manila (UTC+8)
  configTime(gmtOffsetSec, daylightOffsetSec, "pool.ntp.org", "time.nist.gov");
  Serial.println("Syncing time...");
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Syncing Time...");
  display.display();
  struct tm timeinfo;
  while (!getLocalTime(&timeinfo))
  {
    delay(1000);
    Serial.print(".");
  }
  Serial.println("\nTime Synced");
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Time Synced!");
  display.display();
  delay(1000);

  // Initialize QR code reader
  reader.setup();
  reader.cameraConfig.frame_size = FRAMESIZE_QVGA;
  reader.cameraConfig.jpeg_quality = 10;
  reader.cameraConfig.fb_count = 1;
  reader.beginOnCore(1);

  // Start QR code task
  xTaskCreate(onQrCodeTask, "onQrCode", 6 * 1024, NULL, 4, NULL);

  // Fetch class data at startup
  getClassData();
  updateOLED(activeClassName);
}

// Returns formatted HH:MM string
String getFormattedTime()
{
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo))
  {
    return "Error";
  }
  char timeStr[9];
  snprintf(timeStr, sizeof(timeStr), "%02d:%02d", timeinfo.tm_hour, timeinfo.tm_min);
  return String(timeStr);
}

// Update OLED with room name, current time, and active class or custom message
void updateOLED(const String &activeClass)
{
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Test Room 1");
  display.println(getFormattedTime());
  if (!activeClass.isEmpty())
  {
    display.println(activeClass);
  }
  else
  {
    display.println("No active class");
  }
  display.display();
}

// Helper function to display a custom message on the OLED
void updateOLEDMessage(const String &message)
{
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("Test Room 1");
  display.println(getFormattedTime());
  display.println(message);
  display.display();
}

unsigned long lastFetchTime = 0;
const unsigned long fetchInterval = 60000; // 60 seconds

void loop()
{
  pinMode(RELAY_PIN, OUTPUT);
  if (millis() - lastFetchTime >= fetchInterval)
  {
    getClassData();
    digitalWrite(RELAY_PIN, HIGH);
    Serial.println("Relay should be OFF now.");
    updateOLED(activeClassName);
    lastFetchTime = millis();
  }
}

void getClassData()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi not connected! Retrying...");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, String(apiUrl) + "classes.json");
  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK)
  {
    String payload = http.getString();
    processClassData(payload);
  }
  else
  {
    Serial.printf("HTTP Error code: %d. Retrying in next cycle...\n", httpCode);
  }
  http.end();
}

// --- processClassData ---
void processClassData(const String &payload)
{
  DynamicJsonDocument doc(4096);
  DeserializationError error = deserializeJson(doc, payload);
  if (error)
  {
    Serial.println("JSON deserialization failed");
    return;
  }

  String today = getCurrentDay();
  activeClassFound = false;

  struct tm timeinfo;
  if (!getLocalTime(&timeinfo))
  {
    Serial.println("Failed to obtain time");
    return;
  }
  int currentTimeInMinutes = timeinfo.tm_hour * 60 + timeinfo.tm_min;

  JsonObject classes = doc.as<JsonObject>();
  for (JsonPair keyValue : classes)
  {
    String classId = keyValue.key().c_str();
    JsonObject classInfo = keyValue.value().as<JsonObject>();

    // Skip archived classes or those not in the specific room
    if (classInfo.containsKey("archiveClass") && classInfo["archiveClass"].as<bool>() == true)
    {
      continue;
    }
    if (!classInfo.containsKey("room") || classInfo["room"].as<String>() != "Test Room 1")
    {
      continue;
    }

    JsonArray days = classInfo["days"];
    String classTime = classInfo["time"].as<String>();

    int startHour, startMinute, endHour, endMinute;
    sscanf(classTime.c_str(), "%d:%d - %d:%d", &startHour, &startMinute, &endHour, &endMinute);
    int classStartTimeInMinutes = startHour * 60 + startMinute;
    int classEndTimeInMinutes = endHour * 60 + endMinute;

    for (JsonVariant day : days)
    {
      if (day.as<String>() == today)
      {
        if (currentTimeInMinutes >= classStartTimeInMinutes && currentTimeInMinutes <= classEndTimeInMinutes)
        {
          Serial.println("Active Class Found:");
          Serial.println("Class ID: " + classId);
          // Save current active class as last active class if different
          if (activeClassId != "" && activeClassId != classId)
          {
            lastActiveClassId = activeClassId;
            Serial.println("Setting lastActiveClassId to: " + lastActiveClassId);
          }
          activeClassId = classId;
          activeClassName = classInfo["name"].as<String>();
          activeClassFound = true;
          updateOLED(activeClassName);
          return;
        }
      }
    }
  }

  if (!activeClassFound)
  {
    Serial.println("No active class at the moment.");
    // If there was a previously active class, update lastActiveClassId.
    if (activeClassId != "")
    {
      lastActiveClassId = activeClassId;
      Serial.println("Setting lastActiveClassId to: " + lastActiveClassId);
    }
    activeClassId = "";
    activeClassName = "";
    updateOLEDMessage("No active class");
  }
}

// --- updatePreviousClassTimeout ---
void updatePreviousClassTimeout(const String &userId)
{
  if (lastActiveClassId != "")
  {
    Serial.println("Updating timeout for lastActiveClassId: " + lastActiveClassId);
    updateOLEDMessage("Updating Timeout...");
    updateTimeoutForClass(userId, lastActiveClassId);
  }
  else
  {
    Serial.println("No lastActiveClassId to update.");
  }
}

bool isUserEnrolledInClass(const String &userId, const String &classId)
{
  if (WiFi.status() == WL_CONNECTED)
  {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    String encodedUserId = encodeURIComponent(userId);
    String url = String(apiUrl) + "logins/" + encodedUserId + "/enrolledClasses/" + classId + ".json";
    Serial.println("Request URL: " + url);
    http.begin(client, url);
    int httpCode = http.GET();

    if (httpCode > 0)
    {
      if (httpCode == HTTP_CODE_OK)
      {
        String payload = http.getString();
        Serial.println("Response: " + payload);
        if (payload != "null")
        {
          Serial.println("User " + userId + " is enrolled in class: " + classId);
          http.end();
          return true;
        }
        else
        {
          Serial.println("User " + userId + " is not enrolled in class: " + classId);
        }
      }
      else
      {
        Serial.printf("HTTP Error code: %d\n", httpCode);
      }
    }
    else
    {
      Serial.printf("Connection failed: %s\n", http.errorToString(httpCode).c_str());
    }
    http.end();
  }
  else
  {
    Serial.println("WiFi not connected!");
  }
  return false;
}

void waitForQRCodeRemoval()
{
  const unsigned long removalThreshold = 2000;
  unsigned long absenceStart = millis();
  struct QRCodeData tempData;
  while (true)
  {
    if (reader.receiveQrCode(&tempData, 100) && tempData.valid)
    {
      absenceStart = millis();
    }
    else
    {
      if (millis() - absenceStart >= removalThreshold)
      {
        break;
      }
    }
    vTaskDelay(100 / portTICK_PERIOD_MS);
  }
}

// --- onQrCodeTask ---
void onQrCodeTask(void *pvParameters)
{
  const unsigned long scanCooldown = 2000;
  struct QRCodeData qrCodeData;
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);

  static String lastScannedUser = "";
  static unsigned long lastScanTime = 0;
  const unsigned long userCooldownPeriod = 5000;

  while (true)
  {
    if (!scanningEnabled)
    {
      vTaskDelay(100 / portTICK_PERIOD_MS);
      continue;
    }

    if (reader.receiveQrCode(&qrCodeData, 100))
    {
      if (qrCodeData.valid)
      {
        // 1) Grab the hex string from the QR payload
        String userIdHex = (const char *)qrCodeData.payload;
        Serial.println("QR Code scanned (hex): " + userIdHex);

        // 2) Decode the hex into the real userId
        String userId = decodeHex(userIdHex);
        Serial.println("Decoded user ID: " + userId);
        Serial.println("QR Code scanned: " + userId);

        // Special handling for hall pass...
        if (userId.equals("hallpasstest"))
        {
          scanningEnabled = false;
          Serial.println("Hall pass QR code detected, activating relay...");
          playTone(1500, 300);
          digitalWrite(RELAY_PIN, LOW);
          updateOLEDMessage("Hall Pass Detected!");
          waitForQRCodeRemoval();
          vTaskDelay(2000 / portTICK_PERIOD_MS);
          digitalWrite(RELAY_PIN, HIGH);
          Serial.println("Relay OFF after hall pass.");
          updateOLED(activeClassName);
          scanningEnabled = true;
          lastScannedUser = "";
          continue;
        }

        if (userId == lastScannedUser && (millis() - lastScanTime < userCooldownPeriod))
        {
          Serial.println("Duplicate scan detected for user " + userId + ", ignoring.");
          updateOLEDMessage("Duplicate scan");
          waitForQRCodeRemoval();
          lastScannedUser = "";
          vTaskDelay(scanCooldown / portTICK_PERIOD_MS);
          continue;
        }

        lastScannedUser = userId;
        lastScanTime = millis();

        // Always attempt to update timeout for the previous (last active) class for this user
        updatePreviousClassTimeout(userId);

        // Process attendance for the current active class if present
        if (activeClassFound && !activeClassId.isEmpty())
        {
          if (isUserEnrolledInClass(userId, activeClassId))
          {
            // --- Successful QR scan buzzer ---
            // This tone indicates that a valid QR scan for an enrolled user is detected.
            playTone(2000, 300);

            String userFullName = getUserFullName(userId);
            Serial.println("Valid user (" + userFullName + ") detected, processing attendance...");
            updateOLEDMessage("Processing Attendance");
            scanningEnabled = false;
            digitalWrite(RELAY_PIN, LOW);
            Serial.println("Relay ON");

            markAttendance(userId, activeClassId);

            vTaskDelay(2000 / portTICK_PERIOD_MS);
            digitalWrite(RELAY_PIN, HIGH);
            Serial.println("Relay OFF after processing attendance.");
            scanningEnabled = true;
          }
          else
          {
            // --- Unenrolled buzzer ---
            // This tone indicates the user is not enrolled in the current active class.
            playTone(2000, 1000);
            Serial.println("User not enrolled in the active class: " + userId);
            updateOLEDMessage("Not Enrolled");
          }
        }
        else
        {
          Serial.println("No active class to mark attendance.");
          updateOLEDMessage("No active class");
        }

        waitForQRCodeRemoval();
        lastScannedUser = "";
        vTaskDelay(scanCooldown / portTICK_PERIOD_MS);
      }
      else
      {
        Serial.println("QR Code detected but invalid.");
      }
    }
    vTaskDelay(100 / portTICK_PERIOD_MS);
  }
}

String encodeURIComponent(String str)
{
  String encoded = "";
  char c;
  for (int i = 0; i < str.length(); i++)
  {
    c = str[i];
    if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~')
    {
      encoded += c;
    }
    else
    {
      encoded += "%" + String(c, HEX);
    }
  }
  return encoded;
}

String getCurrentDay()
{
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo))
  {
    Serial.println("Failed to obtain time");
    return "";
  }
  const char *daysOfWeek[] = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
  return String(daysOfWeek[timeinfo.tm_wday]);
}

void markAttendance(const String &userId, const String &classId)
{
  if (WiFi.status() == WL_CONNECTED)
  {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    String attendanceUrl = String(apiUrl) + "logins/" + userId + "/enrolledClasses/" + classId + "/attendance.json";
    http.begin(client, attendanceUrl);
    int httpCode = http.GET();

    if (httpCode == HTTP_CODE_OK)
    {
      String payload = http.getString();
      http.end();

      struct tm timeinfo;
      if (!getLocalTime(&timeinfo))
      {
        Serial.println("Failed to obtain time");
        return;
      }
      char dateStr[11];
      snprintf(dateStr, sizeof(dateStr), "%04d-%02d-%02d",
               timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday);

      char timeStr[9];
      int hour = timeinfo.tm_hour;
      String period = (hour >= 12) ? "PM" : "AM";
      hour = (hour > 12) ? (hour - 12) : (hour == 0 ? 12 : hour);
      snprintf(timeStr, sizeof(timeStr), "%02d:%02d %s", hour, timeinfo.tm_min, period.c_str());

      if (payload == "false")
      {
        http.begin(client, attendanceUrl);
        http.addHeader("Content-Type", "application/json");
        int putCode = http.PUT("true");
        http.end();

        if (putCode == HTTP_CODE_OK)
        {
          Serial.println("Attendance marked for user: " + userId);

          String logUrl = String(apiUrl) + "logins/" + userId + "/enrolledClasses/" + classId + "/attendanceLogs.json";
          http.begin(client, logUrl);
          http.addHeader("Content-Type", "application/json");
          String logPayload = "{\"date\":\"" + String(dateStr) +
                              "\",\"time_in\":\"" + String(timeStr) +
                              "\",\"scanner_in\":\"" + scannerIdTimeIn + "\"}";
          int postCode = http.POST(logPayload);
          http.end();

          if (postCode == HTTP_CODE_OK)
          {
            Serial.println("Attendance log (time-in) added for user: " + userId);
            updateOLEDMessage("Attendance Recorded");
            delay(1500); // Let the user read the message
            playTone(2000, 300);
          }
          else
          {
            Serial.printf("Failed to add attendance log (time in). HTTP error code: %d\n", postCode);
          }
        }
        else
        {
          Serial.printf("Failed to mark attendance. HTTP error code: %d\n", putCode);
        }
      }
      else
      {
        Serial.println("Attendance already marked for user: " + userId + " in class " + classId);
        updateTimeoutForClass(userId, classId);
      }
    }
    else
    {
      Serial.printf("Failed to fetch attendance status. HTTP error code: %d\n", httpCode);
      http.end();
    }
  }
  else
  {
    Serial.println("WiFi not connected!");
  }
}

void updateTimeoutForClass(const String &userId, const String &classId)
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi not connected!");
    return;
  }

  // Do not immediately activate the relay.
  bool updateSuccess = false;
  bool openLogFound = false;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String logUrl = String(apiUrl) + "logins/" + userId + "/enrolledClasses/" + classId + "/attendanceLogs.json";
  http.begin(client, logUrl);
  int logCode = http.GET();

  if (logCode == HTTP_CODE_OK)
  {
    String logPayload = http.getString();
    http.end();

    DynamicJsonDocument doc(2048);
    DeserializationError error = deserializeJson(doc, logPayload);
    if (error)
    {
      Serial.println("Failed to parse attendance logs JSON");
      digitalWrite(RELAY_PIN, HIGH); // Ensure relay remains off
      return;
    }

    // Iterate over the attendance logs looking for an open log (has "time_in" but no "time_out")
    for (JsonPair kv : doc.as<JsonObject>())
    {
      JsonObject logEntry = kv.value().as<JsonObject>();
      if (logEntry.containsKey("time_in") && !logEntry.containsKey("time_out"))
      {
        openLogFound = true;
        // Only now activate the relay since an open log exists.
        digitalWrite(RELAY_PIN, LOW);

        struct tm timeinfo;
        if (!getLocalTime(&timeinfo))
        {
          Serial.println("Failed to obtain time");
          digitalWrite(RELAY_PIN, HIGH);
          return;
        }
        char timeOutStr[9];
        int hour = timeinfo.tm_hour;
        String period = (hour >= 12) ? "PM" : "AM";
        hour = (hour > 12) ? (hour - 12) : (hour == 0 ? 12 : hour);
        snprintf(timeOutStr, sizeof(timeOutStr), "%02d:%02d %s", hour, timeinfo.tm_min, period.c_str());

        String updateUrl = String(apiUrl) + "logins/" + userId + "/enrolledClasses/" + classId + "/attendanceLogs/" + kv.key().c_str() + ".json";
        http.begin(client, updateUrl);
        http.addHeader("Content-Type", "application/json");
        String patchPayload = "{\"time_out\":\"" + String(timeOutStr) +
                              "\",\"scanner_out\":\"" + scannerIdTimeOut + "\"}";
        int patchCode = http.sendRequest("PATCH", patchPayload);
        http.end();

        if (patchCode == HTTP_CODE_OK)
        {
          Serial.println("Attendance timeout updated for user: " + userId + " in class " + classId);
          updateOLEDMessage("Timeout Updated");
          playTone(2000, 300);
          updateSuccess = true;
          break;
        }
        else
        {
          Serial.printf("Failed to update attendance log with timeout. HTTP error code: %d\n", patchCode);
        }
      }
    }

    if (!openLogFound)
    {
      Serial.println("No open attendance log found for class " + classId + " for user " + userId);
      updateOLEDMessage("No open log");
    }
  }
  else
  {
    Serial.printf("Failed to fetch attendance logs. HTTP error code: %d\n", logCode);
    http.end();
  }

  // Only if an update occurred (relay activated earlier) do we delay and then turn it off.
  if (updateSuccess)
  {
    delay(2000); // Wait for 2 seconds
  }
  // Ensure relay is always set HIGH (closed) at the end.
  digitalWrite(RELAY_PIN, HIGH);
}

void updateAllTimeouts(const String &userId, const String &currentActiveClassId)
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi not connected!");
    return;
  }
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String classesUrl = String(apiUrl) + "logins/" + userId + "/enrolledClasses.json";
  http.begin(client, classesUrl);
  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK)
  {
    String payload = http.getString();
    http.end();
    DynamicJsonDocument doc(4096);
    DeserializationError error = deserializeJson(doc, payload);
    if (error)
    {
      Serial.println("Failed to parse enrolled classes JSON");
      return;
    }

    for (JsonPair kv : doc.as<JsonObject>())
    {
      String classId = kv.key().c_str();
      if (currentActiveClassId != "" && classId == currentActiveClassId)
      {
        continue;
      }
      updateTimeoutForClass(userId, classId);
    }
  }
  else
  {
    Serial.printf("Failed to fetch enrolled classes. HTTP error code: %d\n", httpCode);
    http.end();
  }
}

String getUserFullName(const String &userId)
{
  if (WiFi.status() == WL_CONNECTED)
  {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    String encodedUserId = encodeURIComponent(userId);
    String url = String(apiUrl) + "logins/" + encodedUserId + ".json";
    Serial.println("Fetching user full name from: " + url);
    http.begin(client, url);
    int httpCode = http.GET();
    String fullName = userId;
    if (httpCode == HTTP_CODE_OK)
    {
      String payload = http.getString();
      DynamicJsonDocument doc(1024);
      DeserializationError error = deserializeJson(doc, payload);
      if (!error)
      {
        if (doc.containsKey("name"))
        {
          fullName = doc["name"].as<String>();
        }
      }
      else
      {
        Serial.println("Failed to deserialize user JSON");
      }
    }
    else
    {
      Serial.printf("HTTP error fetching user info: %d\n", httpCode);
    }
    http.end();
    return fullName;
  }
  else
  {
    Serial.println("WiFi not connected!");
    return userId;
  }
}
