// utils/conversations/conversationHelpers.ts
//
// Sentral logikk for å lese den nye samtale-/deltaker-kontrakten fra backend.
// Backend modellerer ikke lenger isGroup/isPendingApproval eller groupRequestStatus
// som egne felt — det utledes av `type` (ConversationType) og deltakerens
// `status` (ConversationStatus) + `role` (ParticipantRole).
//
// Speiler AFBack:
//   ConversationType:   DirectChat=0, GroupChat=1, PendingRequest=2
//   ConversationStatus: Pending=0, Accepted=1, Rejected=2
//   ParticipantRole:    PendingSender=0, PendingRecipient=1, Member=2, Creator=3

import {
  ConversationDTO,
  ConversationParticipantDTO,
  ConversationType,
  ConversationStatus,
  ParticipantRole,
} from "@shared/types/ConversationDTO";
import { GroupRequestStatus } from "@shared/types/UserSummaryDTO";

export const isGroupConversation = (conv: Pick<ConversationDTO, "type">): boolean =>
  conv.type === ConversationType.GroupChat;

export const isPendingConversation = (conv: Pick<ConversationDTO, "type">): boolean =>
  conv.type === ConversationType.PendingRequest;

/**
 * Finner den andre deltakeren i en direkte samtale (navn/avatar ligger under .user).
 */
export const getOtherParticipant = (
  conv: Pick<ConversationDTO, "participants">,
  currentUserId: string | number | null | undefined,
): ConversationParticipantDTO | undefined =>
  conv.participants.find((p) => p.user.id !== currentUserId);

/**
 * Utleder gruppe-forespørselsstatus for en deltaker fra status + role.
 * Backend har ikke lenger et eget `groupRequestStatus`-felt.
 */
export const deriveGroupRequestStatus = (
  participant: Pick<ConversationParticipantDTO, "status" | "role">,
): GroupRequestStatus => {
  if (participant.role === ParticipantRole.Creator) return GroupRequestStatus.Creator;
  if (participant.status === ConversationStatus.Rejected) return GroupRequestStatus.Rejected;
  if (participant.status === ConversationStatus.Accepted) return GroupRequestStatus.Approved;
  return GroupRequestStatus.Pending;
};
