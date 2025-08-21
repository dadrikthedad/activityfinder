
// Hook for submitting reports
import { useState, useCallback } from 'react';
import { submitReport } from '@/services/support/supportService';
import { useAsyncOperation } from './useAsyncOperation';
import { ReportRequestDTO, ReportResponseDTO } from '@shared/types/report/reportDTOs';
import { PriorityEnum, ReportTypeEnum } from '@shared/types/report/reportEnums';
export function useSubmitReport() {
  const { data, isLoading: isPending, error, execute, reset } = useAsyncOperation<any>();

  const mutateAsync = useCallback((payload: ReportRequestDTO) => {
    return execute(() => submitReport(payload));
  }, [execute]);

  return {
    mutateAsync,
    isPending,
    error,
    data,
    reset
  };
}