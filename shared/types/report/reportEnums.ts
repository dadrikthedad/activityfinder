export enum PriorityEnum {
  Low = 1,
  Medium = 2,
  High = 3,
  Critical = 4
}

export enum ReportStatusEnum {
  Open = 1,
  InProgress = 2,
  WaitingForInfo = 3,
  UnderReview = 4,
  Resolved = 5,
  Closed = 6,
  Duplicate = 7,
  WontFix = 8,
  CannotReproduce = 9
}

// Enums matching backend
export enum ReportTypeEnum {
  BugReport = 1,
  UserReport = 2,
  FeatureRequest = 3,
  Other = 4
}