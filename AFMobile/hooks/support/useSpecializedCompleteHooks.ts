// hooks/support/useSpecializedCompleteHooks.ts
// Spesialiserte wrappers rundt useCompleteReport for bug-rapporter og bruker-rapporter.
import { useCallback } from 'react';
import { useCompleteReport } from './useCompleteReport';
import { createBugReportPayload, createUserReportPayload } from '@/services/support/supportService';
import { PriorityEnum } from '@shared/types/report/reportEnums';
import { ReportRequestDTO } from '@shared/types/report/reportDTOs';

interface RNFile {
  uri: string;
  type: string;
  name: string;
}

export function useCompleteBugReport() {
  const completeReport = useCompleteReport();

  const submitBugReportWithAttachments = useCallback(async (
    title: string,
    description: string,
    attachments: RNFile[] = [],
    stepsToReproduce?: string,
    expectedBehavior?: string,
    actualBehavior?: string,
    priority: PriorityEnum = PriorityEnum.Medium
  ) => {
    const payload = await createBugReportPayload(
      title,
      description,
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
      priority
    );
    return completeReport.submitReportWithAttachments(payload, attachments);
  }, [completeReport]);

  return {
    submitBugReportWithAttachments,
    isProcessing: completeReport.isProcessing,
    currentStep: completeReport.currentStep,
    uploadProgress: completeReport.uploadProgress,
    error: completeReport.error,
    result: completeReport.result,
    reset: completeReport.reset,
  };
}

export function useCompleteUserReport() {
  const completeReport = useCompleteReport();

  const submitUserReportWithAttachments = useCallback(async (
    title: string,
    description: string,
    reportedUserId: string,
    attachments: RNFile[] = [],
    priority: PriorityEnum = PriorityEnum.Medium
  ) => {
    const payload = createUserReportPayload(title, description, reportedUserId, priority);
    return completeReport.submitReportWithAttachments(payload, attachments);
  }, [completeReport]);

  return {
    submitUserReportWithAttachments,
    isProcessing: completeReport.isProcessing,
    currentStep: completeReport.currentStep,
    uploadProgress: completeReport.uploadProgress,
    error: completeReport.error,
    result: completeReport.result,
    reset: completeReport.reset,
  };
}

export function useCompleteCustomReport() {
  const completeReport = useCompleteReport();

  const submitCustomReportWithAttachments = useCallback(async (
    reportData: ReportRequestDTO,
    attachments: RNFile[] = []
  ) => {
    return completeReport.submitReportWithAttachments(reportData, attachments);
  }, [completeReport]);

  return {
    submitCustomReportWithAttachments,
    isProcessing: completeReport.isProcessing,
    currentStep: completeReport.currentStep,
    uploadProgress: completeReport.uploadProgress,
    error: completeReport.error,
    result: completeReport.result,
    reset: completeReport.reset,
  };
}
