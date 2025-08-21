import { useCallback } from 'react';
import { useAsyncOperation } from './useAsyncOperation';
import { ReportResponseDTO } from '@shared/types/report/reportDTOs';
import { getReport } from '@/services/support/supportService';

export function useReport(reportId?: string, token?: string) {
  const { data, isLoading, error, execute, reset } = useAsyncOperation<ReportResponseDTO>();

  const fetchReport = useCallback(async () => {
    if (!reportId || !token) {
      throw new Error('Report ID and token are required');
    }
    return execute(() => getReport(reportId, token));
  }, [reportId, token, execute]);

  return {
    data,
    isLoading,
    error,
    fetchReport,
    reset
  };
}