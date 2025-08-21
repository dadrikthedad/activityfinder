// hooks/useCompleteBugReport.ts
import { useCallback } from 'react';
import { useCompleteReport } from './useCompleteReport';
import { createBugReportPayload } from '@/services/support/supportService';
import { PriorityEnum } from '@shared/types/report/reportEnums';
import { createUserReportPayload } from '@/services/support/supportService';
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
    // Create payload with browser info
    const payload = await createBugReportPayload(
      title,
      description,
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
      priority
    );

    // Submit report with attachments
    return await completeReport.submitReportWithAttachments(payload, attachments);
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
    // Create payload
    const payload = createUserReportPayload(title, description, reportedUserId, priority);

    // Submit report with attachments
    return await completeReport.submitReportWithAttachments(payload, attachments);
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
    return await completeReport.submitReportWithAttachments(reportData, attachments);
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