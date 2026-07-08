// ESP32 RS232 Scale Bridge
// Reads weight from an RS232 weighing indicator (via MAX3232 on UART2) and
// pushes it to WebSocket clients as JSON: {"weight": 12.5, "stable": true, "unit": "kg"}
//
// Current mode: SIMULATED readings (hardware not yet connected).
// To switch to the real scale, set USE_SIMULATED_SCALE to 0 once the
// MAX3232 module and scale are wired to GPIO16 (RX2) / GPIO17 (TX2).

#include <WiFi.h>
#include <WebSocketsServer.h>

// WiFi credentials live in secrets.h (git-ignored) — copy secrets.example.h
#include "secrets.h"

#define WEBSOCKET_PORT 81
#define READING_INTERVAL_MS 1000

#define USE_SIMULATED_SCALE 1

// Scale serial config (per USERMANUAL-MK231OIML180416: default 9600, 8-N-1)
#define SCALE_BAUD 9600
#define SCALE_RX_PIN 16  // ESP32 RX2 <- module TXD
#define SCALE_TX_PIN 17  // ESP32 TX2 -> module RXD

WebSocketsServer webSocket(WEBSOCKET_PORT);

struct ScaleReading {
  float weight;
  bool stable;
  bool valid;      // false if no/unparseable data this cycle
  const char* unit;
};

// ---- Simulated data source (delete once real scale is wired) ----
// Ramps up to a target weight, holds stable for a while, then resets —
// roughly what placing/removing an object on a scale looks like.
ScaleReading getSimulatedReading() {
  static float target = 12.5;
  static float current = 0.0;
  static int stableTicks = 0;

  ScaleReading r;
  r.unit = "kg";
  r.valid = true;

  if (current < target - 0.05) {
    current += (target - current) * 0.4;              // approach target
    current += (random(-10, 10)) / 100.0;             // jitter while settling
    if (current < 0) current = 0;
    r.stable = false;
    stableTicks = 0;
  } else {
    current = target;
    r.stable = true;
    if (++stableTicks > 8) {                          // held stable ~8s: new object
      current = 0.0;
      target = random(50, 2000) / 10.0;               // next object 5.0–200.0 kg
      stableTicks = 0;
      r.stable = false;
    }
  }

  r.weight = roundf(current * 10) / 10.0;
  return r;
}

// ---- Real scale via UART2 (stub — implement when hardware arrives) ----
// Scale sends continuous ASCII lines, one per reading, terminated \r\n:
//   S1,S2,S3Data S4\r\n     e.g. "ST,GS,+0012.5 kg\r\n"
//   S1: ST=stable US=unstable OL=overload
//   S2: GS=gross NT=net
//   S3: + or -
//   Data: weight incl. decimal point
//   S4: kg or lb
// Implementation plan: read from Serial2 until '\n', then parse:
//   - stable  = line starts with "ST"
//   - weight  = atof() of the signed value after the second comma
//   - unit    = trailing "kg"/"lb"
//   - r.valid = false on OL or malformed line
ScaleReading getScaleReading() {
  ScaleReading r = { 0.0, false, false, "kg" };
  // TODO: parse Serial2 lines here (9600 8N1 on RX2=GPIO16 / TX2=GPIO17)
  return r;
}

ScaleReading getReading() {
#if USE_SIMULATED_SCALE
  return getSimulatedReading();
#else
  return getScaleReading();
#endif
}

void webSocketEvent(uint8_t clientNum, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED: {
      IPAddress ip = webSocket.remoteIP(clientNum);
      Serial.printf("[ws] client %u connected from %s\n", clientNum, ip.toString().c_str());
      break;
    }
    case WStype_DISCONNECTED:
      Serial.printf("[ws] client %u disconnected\n", clientNum);
      break;
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);

#if !USE_SIMULATED_SCALE
  Serial2.begin(SCALE_BAUD, SERIAL_8N1, SCALE_RX_PIN, SCALE_TX_PIN);
#endif

  Serial.printf("\nConnecting to WiFi \"%s\"", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi connected, IP: ");
  Serial.println(WiFi.localIP());
  Serial.printf("WebSocket server: ws://%s:%d/\n", WiFi.localIP().toString().c_str(), WEBSOCKET_PORT);

  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();

  static unsigned long lastPush = 0;
  if (millis() - lastPush >= READING_INTERVAL_MS) {
    lastPush = millis();

    ScaleReading r = getReading();
    if (r.valid) {
      char json[80];
      snprintf(json, sizeof(json), "{\"weight\": %.1f, \"stable\": %s, \"unit\": \"%s\"}",
               r.weight, r.stable ? "true" : "false", r.unit);
      webSocket.broadcastTXT(json);
      Serial.println(json);
    }
  }
}
