// utils/formatters.ts

export function formatSentDate(sentAt: string): string {
    const sentDate = new Date(sentAt);
    const now = new Date();
  
    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
  
    const time = sentDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  
    if (isSameDay(sentDate, now)) {
      return time;
    } else if (isSameDay(sentDate, yesterday)) {
      return `Yesterday, ${time}`;
    } else {
      return `${sentDate.toLocaleDateString("no-NO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })}, ${time}`;
    }
  }
  