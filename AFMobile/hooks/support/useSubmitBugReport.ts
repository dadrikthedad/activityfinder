import { useState, useCallback } from 'react';
import { useSubmitReport } from './useSubmitReport';
import { createBugReportPayload } from '@/services/support/supportService';
import { PriorityEnum } from '@shared/types/report/reportEnums';

export function useSubmitBugReport() {
  const [isCreatingPayload, setIsCreatingPayload] = useState(false);
  const submitMutation = useSubmitReport();

  const submitBugReport = useCallback(async (
    title: string,
    description: string,
    stepsToReproduce?: string,
    expectedBehavior?: string,
    actualBehavior?: string,
    priority: PriorityEnum = PriorityEnum.Medium
  ) => {
    try {
      setIsCreatingPayload(true);
      const payload = await createBugReportPayload(
        title,
        description,
        stepsToReproduce,
        expectedBehavior,
        actualBehavior,
        priority
      );
      return await submitMutation.mutateAsync(payload);
    } finally {
      setIsCreatingPayload(false);
    }
  }, [submitMutation]);

  return {
    submitBugReport,
    isSubmitting: submitMutation.isPending || isCreatingPayload,
    error: submitMutation.error,
    data: submitMutation.data,
    reset: submitMutation.reset
  };
}