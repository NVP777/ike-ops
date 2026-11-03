// Small vibration feedback. Works on Android and most phones that support it; silently does nothing elsewhere.
export const buzz = (p = 8) => { try { navigator.vibrate?.(p); } catch {} };
