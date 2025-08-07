import { MessageRequestDTO } from "./MessageReqeustDTO";

export interface PaginatedMessageRequestsDTO {
  requests: MessageRequestDTO[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}