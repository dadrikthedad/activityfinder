// hooks/useCompleteReport.ts
import { useState, useCallback } from 'react';
import { useSubmitReport } from './useSubmitReport';
import { useReportAttachments } from './useReportAttachments';
import { ReportRequestDTO } from '@shared/types/report/reportDTOs';

// React Native file type
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
  // State
  isProcessing: boolean;
  currentStep: 'idle' | 'submitting' | 'uploading' | 'completed' | 'error';
  uploadProgress: number;
  error: string | null;
  result: CompleteReportResult | null;
  
  // Actions
  submitReportWithAttachments: (
    reportData: ReportRequestDTO, 
    attachments?: RNFile[]
  ) => Promise<CompleteReportResult | null>;
  reset: () => void;
}

export function useCompleteReport(): UseCompleteReportReturn {
  const [currentStep, setCurrentStep] = useState<'idle' | 'submitting' | 'uploading' | 'completed' | 'error'>('idle');
  const [result, setResult] = useState<CompleteReportResult | null>(null);
  
  // Use existing hooks
  const reportSubmission = useSubmitReport();
  const attachmentUpload = useReportAttachments();

  const isProcessing = reportSubmission.isPending || attachmentUpload.isUploading;
  
  // Combined error from both operations
  const error = reportSubmission.error?.message || attachmentUpload.error;

  const reset = useCallback(() => {
    setCurrentStep('idle');
    setResult(null);
    reportSubmission.reset();
    attachmentUpload.clearError();
    attachmentUpload.clearAttachments();
  }, [reportSubmission, attachmentUpload]);

  const submitReportWithAttachments = useCallback(async (
    reportData: ReportRequestDTO,
    attachments: RNFile[] = []
  ): Promise<CompleteReportResult | null> => {
    try {
      // Step 1: Submit report
      setCurrentStep('submitting');
      console.log('🔍 Starting report submission...');
      
      const reportResult = await reportSubmission.mutateAsync(reportData);
      if (!reportResult) {
        setCurrentStep('error');
        return null;
      }

      console.log(`✅ Report submitted with ID: ${reportResult.reportId}`);

      // Step 2: Upload attachments (if any)
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

      // Step 3: Complete
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
      return null;
    }
  }, [reportSubmission, attachmentUpload]);

  return {
    // State
    isProcessing,
    currentStep,
    uploadProgress: attachmentUpload.uploadProgress,
    error,
    result,
    
    // Actions
    submitReportWithAttachments,
    reset,
  };
}