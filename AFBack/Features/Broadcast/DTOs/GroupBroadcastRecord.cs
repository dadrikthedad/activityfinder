using AFBack.Common.DTOs;
using AFBack.DTOs;
using AFBack.Features.Conversation.DTOs.Response;
using AFBack.Features.MessageNotifications.Models.Enum;
using AFBack.Features.SyncEvents.Enums;

namespace AFBack.Features.Broadcast.DTOs;

/// <summary>
/// Samler alle parametere som varierer mellom de ulike broadcast-metodene.
/// </summary>
public record GroupBroadcastRecord(
    string ActorUserId, // Brukeren som har utført handlingen - Akseprt, invitert, avslått etc.
    List<string> RecipientIds, // Mottakere av signalr, syncevent og notifikasjon
    ConversationResponse Response, // Den oppdaterte samtalen
    string Summary, // Summary-teksten som viser
    UserSummaryDto ActorUserSummaryDto,
    GroupEventType GroupEventType,
    SyncEventType ActorSyncEventType,
    object ActorSyncPayload,
    SyncEventType RecipientSyncEventType,
    string SignalREvent,
    string LogContext);
