import { ReportTypeEnum, PriorityEnum, ReportStatusEnum } from "./reportEnums";

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
  attachments?: string[];
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
  attachments?: string[];
}