// hooks/support/useCompleteReport.ts
// Orkestrerer innsending av rapport + opplasting av vedlegg i to steg.
import { useState, useCallback } from 'react';
import { submitReport } from '@/services/support/supportService';
import { useReportAttachments } from './useReportAttachments';
import { ReportRequestDTO } from '@shared/types/report/reportDTOs';

interface RNFile {
  uri: string;
  type: string;
  name: string;
}

interface CompleteReportResult {
  reportId: string;
  message: string;
  submittedAt: string;
  attachments?: Array<{
    attachmentId: number;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    uploadedAt: string;
  }>;
}

interface UseCompleteReportReturn {
  isProcessing: boolean;
  currentStep: 'idle' | 'submitting' | 'uploading' | 'completed' | 'error';
  uploadProgress: number;
  error: string | null;
  result: CompleteReportResult | null;
  submitReportWithAttachments: (
    reportData: ReportRequestDTO,
    attachments?: RNFile[]
  ) => Promise<CompleteReportResult | null>;
  reset: () => void;
}

export function useCompleteReport(): UseCompleteReportReturn {
  const [currentStep, setCurrentStep] = useState<'idle' | 'submitting' | 'uploading' | 'completed' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<CompleteReportResult | null>(null);

  const attachmentUpload = useReportAttachments();

  const isProcessing = isSubmitting || attachmentUpload.isUploading;
  const error = submitError || attachmentUpload.error;

  const reset = useCallback(() => {
    setCurrentStep('idle');
    setIsSubmitting(false);
    setSubmitError(null);
    setResult(null);
    attachmentUpload.clearError();
    attachmentUpload.clearAttachments();
  }, [attachmentUpload]);

  const submitReportWithAttachments = useCallback(async (
    reportData: ReportRequestDTO,
    attachments: RNFile[] = []
  ): Promise<CompleteReportResult | null> => {
    try {
      // Steg 1: Send rapport
      setCurrentStep('submitting');
      setIsSubmitting(true);
      setSubmitError(null);
      console.log('🔍 Starting report submission...');

      const reportResult = await submitReport(reportData);
      setIsSubmitting(false);

      if (!reportResult) {
        setCurrentStep('error');
        setSubmitError('Ingen respons fra server');
        return null;
      }

      console.log(`✅ Report submitted with ID: ${reportResult.reportId}`);

      // Steg 2: Last opp vedlegg (hvis noen)
      let uploadedAttachments = undefined;
      if (attachments.length > 0) {
        setCurrentStep('uploading');
        console.log(`🔍 Uploading ${attachments.length} attachments...`);

        uploadedAttachments = await attachmentUpload.uploadMultipleAttachments(
          reportResult.reportId,
          attachments
        );

        if (!uploadedAttachments) {
          setCurrentStep('error');
          return null;
        }

        console.log(`✅ All ${attachments.length} attachments uploaded successfully`);
      }

      // Steg 3: Ferdig
      setCurrentStep('completed');
      const completeResult: CompleteReportResult = {
        ...reportResult,
        attachments: uploadedAttachments,
      };

      setResult(completeResult);
      console.log('✅ Report with attachments completed successfully');
      return completeResult;

    } catch (err) {
      console.error('❌ Error in complete report process:', err);
      setCurrentStep('error');
      setIsSubmitting(false);
      setSubmitError(err instanceof Error ? err.message : 'Ukjent feil');
      return null;
    }
  }, [attachmentUpload]);

  return {
    isProcessing,
    currentStep,
    uploadProgress: attachmentUpload.uploadProgress,
    error,
    result,
    submitReportWithAttachments,
    reset,
  };
}
