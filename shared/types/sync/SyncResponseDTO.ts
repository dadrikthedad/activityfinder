import { SyncEventDTO } from "./SyncEventDTO";

export interface SyncResponseDTO {
  events: SyncEventDTO[];
  requiresFullRefresh: boolean;
}