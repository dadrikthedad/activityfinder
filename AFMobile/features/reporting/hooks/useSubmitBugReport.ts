import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReportingErrorCode } from "@/core/errors/ErrorCode";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import { submitBugReport } from "../services/reportService";
import { useReportAttachments } from "./useReportAttachments";

interface UseSubmitBugReportOptions {
  onSuccess?: () => void;
}

function showError(title: string, body: string) {
  showNotificationToastNative({
    type: LocalToastType.CustomSystemError,
    customTitle: title,
    customBody: body,
  });
}

export function useSubmitBugReport({ onSuccess }: UseSubmitBugReportOptions) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");

  const attachments = useReportAttachments();

  async function submit() {
    if (!title.trim()) {
      showError(t("bug.errorTitle"), t("bug.validationTitleRequired"));
      return;
    }

    if (description.length < 10) {
      showError(t("bug.errorTitle"), t("bug.validationDescriptionMin"));
      return;
    }

    if (description.length > 2000) {
      showError(t("bug.errorTitle"), t("bug.validationDescriptionMin"));
      return;
    }

    const attachmentError = attachments.validateAttachments();
    if (attachmentError === "tooMany") {
      showError(t("bug.errorTitle"), t("report.tooManyAttachments"));
      return;
    }
    if (attachmentError === "tooLarge") {
      showError(t("bug.errorTitle"), t("report.attachmentTooLarge"));
      return;
    }

    setIsSubmitting(true);
    const result = await submitBugReport(
      {
        title: title.trim(),
        description,
        stepsToReproduce: stepsToReproduce.trim() || undefined,
        expectedBehavior: expectedBehavior.trim() || undefined,
        actualBehavior: actualBehavior.trim() || undefined,
      },
      attachments.appendToFormData,
    );
    setIsSubmitting(false);

    if (!result.success) {
      let body: string;
      switch (result.code) {
        case ReportingErrorCode.RateLimited:
          body = t("report.rateLimited");
          break;
        case ReportingErrorCode.TooManyAttachments:
          body = t("report.tooManyAttachments");
          break;
        case ReportingErrorCode.AttachmentTooLarge:
          body = t("report.attachmentTooLarge");
          break;
        default:
          body = result.error;
      }
      showError(t("bug.errorTitle"), body);
      return;
    }

    showNotificationToastNative({
      type: LocalToastType.CustomSystemNotice,
      customTitle: t("bug.successTitle"),
      customBody: t("bug.successBody"),
    });
    onSuccess?.();
  }

  return {
    title,
    setTitle,
    description,
    setDescription,
    stepsToReproduce,
    setStepsToReproduce,
    expectedBehavior,
    setExpectedBehavior,
    actualBehavior,
    setActualBehavior,
    isSubmitting,
    submit,
    attachments,
  };
}
