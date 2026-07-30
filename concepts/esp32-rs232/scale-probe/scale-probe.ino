// Plain 9600 8N1 passthrough (non-inverted). Watch live while re-seating the
// module's GND/VCC jumpers and the scale DB9 — clean "ST,GS,..." text appearing
// when you press a wire pinpoints a loose connection.
// Wiring: GPIO16 <- module TXD, GPIO17 -> module RXD.

#define SCALE_RX_PIN 16
#define SCALE_TX_PIN 17

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial2.begin(9600, SERIAL_8N1, SCALE_RX_PIN, SCALE_TX_PIN);
  Serial.println("\n[probe] 9600 8N1 passthrough. Re-seat GND/VCC/DB9 while watching.");
}

void loop() {
  while (Serial2.available()) {
    uint8_t b = Serial2.read();
    if (b >= 32 && b < 127) Serial.write(b);
    else if (b == '\r') Serial.print("\\r");
    else if (b == '\n') Serial.print("\\n\n");
    else Serial.printf("<%02X>", b);
  }
}
