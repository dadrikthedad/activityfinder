
// En funksjon for å gruppere reaksjoner og telle antall
import { ReactionDTO } from "@shared/types/MessageDTO";

type GroupedReactions = Record<
  string,
  { count: number; userIds: number[]; userNames: string[] }
>;

export function groupReactionsDetailed(reactions: ReactionDTO[]): GroupedReactions {
  const grouped: GroupedReactions = {};

  for (const r of reactions) {
    if (!grouped[r.emoji]) {
      grouped[r.emoji] = {
        count: 1,
        userIds: [r.userId],
        userNames: [r.userFullName ?? `User ${r.userId}`],
      };
    } else {
      grouped[r.emoji].count += 1;
      grouped[r.emoji].userIds.push(r.userId);
      grouped[r.emoji].userNames.push(r.userFullName ?? `User ${r.userId}`);
    }
  }

  return grouped;
}