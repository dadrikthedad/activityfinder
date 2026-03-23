// utils/formatTime.ts
// Konverterer et antall sekunder til mm:ss-format.
// Eks: 90 → "1:30", 5 → "0:05"

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}
