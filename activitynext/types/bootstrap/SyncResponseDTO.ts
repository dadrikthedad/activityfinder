import { SyncEventDTO } from "./SyncEventDTO";

export interface SyncResponseDTO {
  events: SyncEventDTO[];
  syncToken: string;
  requiresFullRefresh?: boolean;
}
