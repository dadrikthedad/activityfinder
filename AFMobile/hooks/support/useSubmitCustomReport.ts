import { useCallback } from 'react';
import { useSubmitReport } from './useSubmitReport';
import { ReportRequestDTO } from '@shared/types/report/reportDTOs';

export function useSubmitCustomReport() {
  const submitMutation = useSubmitReport();

  const submitCustomReport = useCallback((payload: ReportRequestDTO) => {
    return submitMutation.mutateAsync(payload);
  }, [submitMutation]);

  return {
    submitCustomReport,
    isSubmitting: submitMutation.isPending,
    error: submitMutation.error,
    data: submitMutation.data,
    reset: submitMutation.reset
  };
}