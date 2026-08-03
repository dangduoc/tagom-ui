/**
 * Dev-server proxy.
 *
 * `npm run start:lan` serves over HTTPS so a tablet on the LAN gets a secure
 * context for the camera. But an HTTPS page hard-blocks `ws://` as mixed
 * content -- no flag, no prompt, no override -- so the tablet cannot reach the
 * ESP32 scale directly. Routing the socket through this origin makes it a
 * same-origin `wss://` connection, reusing the certificate the tablet already
 * trusts, and the block goes away. No firmware change.
 *
 * Production does not need any of this: the station PC serves the app on
 * `http://localhost`, which is a secure context (camera works) and is not
 * HTTPS (so `ws://` to the ESP32 is allowed). See deployment-plan.md.
 *
 * The ESP32 ignores the request path, so no rewrite is needed.
 *
 * The scale takes a DHCP lease and its address drifts. Override it without
 * editing this file:
 *     $env:SCALE_WS = 'ws://192.168.83.42:81'; npm run start:lan
 */
const SCALE_WS = process.env.SCALE_WS || 'ws://192.168.83.105:81';

module.exports = {
  '/api': {
    target: 'http://localhost:8000',
    secure: false,
  },
  '/scale-ws': {
    target: SCALE_WS,
    ws: true,
    secure: false,
  },
};
