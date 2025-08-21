import { useCallback } from 'react';
import { useSubmitReport } from './useSubmitReport';
import { PriorityEnum } from '@shared/types/report/reportEnums';
import { createUserReportPayload } from '@/services/support/supportService';

export function useSubmitUserReport() {
  const submitMutation = useSubmitReport();

  const submitUserReport = useCallback((
    title: string,
    description: string,
    reportedUserId: string,
    priority: PriorityEnum = PriorityEnum.Medium
  ) => {
    const payload = createUserReportPayload(title, description, reportedUserId, priority);
    return submitMutation.mutateAsync(payload);
  }, [submitMutation]);

  return {
    submitUserReport,
    isSubmitting: submitMutation.isPending,
    error: submitMutation.error,
    data: submitMutation.data,
    reset: submitMutation.reset
  };
}
