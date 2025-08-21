import { ReportTypeEnum, PriorityEnum, ReportStatusEnum } from "./reportEnums";

export interface AttachmentDTO {
  id: number;
  fileUrl: string;
  fileName?: string;
  fileType: string;
  fileSize?: number;
  uploadedAt: string;
}

export interface ReportRequestDTO {
  type: ReportTypeEnum;
  title: string;
  description: string;
  reportedUserId?: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  userAgent?: string;
  browserVersion?: string;
  deviceInfo?: string;
  priority?: PriorityEnum;
}

export interface ReportResponseDTO {
  id: string;
  type: ReportTypeEnum;
  title: string;
  description: string;
  submittedAt: string;
  status: ReportStatusEnum;
  priority: PriorityEnum;
  reportedUserId?: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  userAgent?: string;
  browserVersion?: string;
  deviceInfo?: string;
  updatedAt?: string;
  assignedTo?: string;
  resolution?: string;
  attachments?: AttachmentDTO[];
}

export interface UploadAttachmentResponse {
  attachmentId: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
}