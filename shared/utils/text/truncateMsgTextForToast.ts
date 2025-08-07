export default function truncateText(text: string | null, maxLength: number = 200): string | null {
  if (text === null) return null;
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trimEnd() + '...';
}