// Compact binary wire format for the WebRTC "Direct" transport.
//
// Instead of shipping ~150 bytes of JSON per packet, a full controller frame is
// a fixed 12-byte little-endian record. Axes/triggers are quantized (1 byte
// each); the 15 buttons pack into a 2-byte bitmask. This is the payload that
// flows device-to-device over the data channel; the receiver decodes it back to
// a normal ControllerState before handing it to the local hub/bridge.
//
// IMPORTANT: BUTTON_ORDER fixes the bit positions  the client (encoder) and the
// receiver (decoder) must agree on it, so keep this file identical in both apps.
//
//   bytes  0..3  uint32  seq          (monotonic packet counter, drops stale)
//   bytes  4..5  uint16  button mask  (bit i = BUTTON_ORDER[i] pressed)
//   byte   6     int8    leftStick.x  (value * 127, range -1..1)
//   byte   7     int8    leftStick.y
//   byte   8     int8    rightStick.x
//   byte   9     int8    rightStick.y
//   byte   10    uint8   triggers.LT  (value * 255, range 0..1)
//   byte   11    uint8   triggers.RT

export const BUTTON_ORDER = [
  "A", "B", "X", "Y", "LB", "RB", "LS", "RS",
  "Back", "Start", "Guide", "DPadUp", "DPadDown", "DPadLeft", "DPadRight",
] as const;

export type WireButton = (typeof BUTTON_ORDER)[number];

export interface WireState {
  leftStick: { x: number; y: number };
  rightStick: { x: number; y: number };
  triggers: { LT: number; RT: number };
  buttons: Partial<Record<WireButton, boolean>>;
}

export const PACKET_BYTES = 12;

const clampI8 = (n: number) => Math.max(-127, Math.min(127, Math.round(n * 127)));
const clampU8 = (n: number) => Math.max(0, Math.min(255, Math.round(n * 255)));
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function encodeState(s: WireState, seq: number): ArrayBuffer {
  const buf = new ArrayBuffer(PACKET_BYTES);
  const v = new DataView(buf);
  v.setUint32(0, seq >>> 0, true);
  let mask = 0;
  for (let i = 0; i < BUTTON_ORDER.length; i++) {
    if (s.buttons[BUTTON_ORDER[i]]) mask |= 1 << i;
  }
  v.setUint16(4, mask, true);
  v.setInt8(6, clampI8(s.leftStick.x));
  v.setInt8(7, clampI8(s.leftStick.y));
  v.setInt8(8, clampI8(s.rightStick.x));
  v.setInt8(9, clampI8(s.rightStick.y));
  v.setUint8(10, clampU8(s.triggers.LT));
  v.setUint8(11, clampU8(s.triggers.RT));
  return buf;
}

export function decodeState(buf: ArrayBuffer): { state: WireState; seq: number } {
  const v = new DataView(buf);
  const seq = v.getUint32(0, true);
  const mask = v.getUint16(4, true);
  const buttons: Record<string, boolean> = {};
  for (let i = 0; i < BUTTON_ORDER.length; i++) {
    buttons[BUTTON_ORDER[i]] = !!(mask & (1 << i));
  }
  return {
    seq,
    state: {
      leftStick: { x: r3(v.getInt8(6) / 127), y: r3(v.getInt8(7) / 127) },
      rightStick: { x: r3(v.getInt8(8) / 127), y: r3(v.getInt8(9) / 127) },
      triggers: { LT: r3(v.getUint8(10) / 255), RT: r3(v.getUint8(11) / 255) },
      buttons,
    },
  };
}
