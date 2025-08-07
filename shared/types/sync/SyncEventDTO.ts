export interface SyncEventDTO {
  id: number;
  eventType: string;
  eventData: string;
  createdAt: string;
  source?: string;
  relatedEntityId?: number;
  relatedEntityType?: string;
}