import { SyncEventDTO } from "./SyncEventDTO";

export interface SyncResponseDTO {
  events: SyncEventDTO[];
  newSyncToken: string;
  requiresFullRefresh: boolean;
  message: string;
}