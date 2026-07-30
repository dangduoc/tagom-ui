// ESP32 RS232 Scale Bridge
// Reads weight from a DIGI/Teraoka DS-166SS weighing indicator (via MAX3232 on
// UART2) and pushes it to WebSocket clients as JSON:
//   {"weight": 12.5, "stable": true, "unit": "kg"}
//
// Current mode: REAL scale via UART2 (USE_SIMULATED_SCALE 0).
// Flip USE_SIMULATED_SCALE to 1 to fall back to fake data (no hardware needed).

#include <WiFi.h>
#include <WebSocketsServer.h>

// WiFi credentials live in secrets.h (git-ignored) — copy secrets.example.h
#include "secrets.h"

#define WEBSOCKET_PORT 81
#define READING_INTERVAL_MS 1000

#define USE_SIMULATED_SCALE 0

// Scale serial config — DS-166SS: 9600, 8-N-1, continuous ASCII stream
#define SCALE_BAUD 9600
// NOTE: this MAX3232 module is labeled host-side, so wiring is STRAIGHT (not crossed):
#define SCALE_RX_PIN 16  // ESP32 RX2 -> module RXD
#define SCALE_TX_PIN 17  // ESP32 TX2 -> module TXD

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

// ---- Real scale via UART2 (DS-166SS) ----
// Continuous ASCII lines, one per reading, terminated \r\n. VERIFIED format
// (captured from real hardware — see CONTEXT.md):
//   S1,S2,S3<data><unit>     e.g. "ST,GS,+  13.88kg\r\n"
//   S1:   ST=stable  US=unstable  OL=overload
//   S2:   GS=gross   (only mode seen)
//   S3:   sign, '+' or '-'
//   data: weight, space-padded/right-aligned, 2 decimals (e.g. "  13.88")
//   unit: "kg" — concatenated straight onto the number, NO space/comma
//
// Non-blocking line buffer: drain everything available each call and return the
// newest complete line. The scale sends several lines/sec; we push at most 1/sec.
// NOTE: atof(line+6) does NOT work here — after the sign come spaces, which atof
// can't parse. Parse the number from just past the sign, where it's space+digits.
ScaleReading getScaleReading() {
  static char line[48];
  static size_t len = 0;

  ScaleReading r = { 0.0, false, false, "kg" };

  while (Serial2.available()) {
    char c = (char)Serial2.read();
    if (c == '\n') {
      line[len] = '\0';
      size_t lineLen = len;
      len = 0;
      if (lineLen && line[lineLen - 1] == '\r') line[--lineLen] = '\0';

      // "ST,GS,+  13.88kg" — need status + two commas at fixed positions
      if (lineLen < 8 || line[2] != ',' || line[5] != ',') continue;
      if (line[0] == 'O' && line[1] == 'L') continue;       // overload → skip

      const char* rest = line + 6;                          // "+  13.88kg"
      char sign = rest[0];
      float weight = atof(rest + 1);                        // atof skips the spaces
      if (sign == '-') weight = -weight;

      r.stable = (line[0] == 'S' && line[1] == 'T');
      r.weight = weight;
      r.unit   = (strstr(rest, "lb") != nullptr) ? "lb" : "kg";
      r.valid  = true;
      // keep draining; the LAST complete line wins
    } else if (len < sizeof(line) - 1) {
      line[len++] = c;
    } else {
      len = 0;                                              // overflow → resync
    }
  }
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
