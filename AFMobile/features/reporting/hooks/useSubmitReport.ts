import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReportingErrorCode } from "@/core/errors/ErrorCode";
import { showNotificationToastNative, LocalToastType } from "@/components/toast/NotificationToastNative";
import { UserReportReason } from "../models/UserReportReason";
import { submitUserReport } from "../services/reportService";
import { useReportAttachments } from "./useReportAttachments";

interface UseSubmitReportOptions {
  reportedUserId: string;
  onSuccess?: () => void;
}

function showError(title: string, body: string) {
  showNotificationToastNative({
    type: LocalToastType.CustomSystemError,
    customTitle: title,
    customBody: body,
  });
}

export function useSubmitReport({ reportedUserId, onSuccess }: UseSubmitReportOptions) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState<UserReportReason | null>(null);
  const [description, setDescription] = useState("");

  const attachments = useReportAttachments();

  async function submit() {
    if (!reason) {
      showError(t("report.errorTitle"), t("report.validationReasonRequired"));
      return;
    }

    if (description.length < 10) {
      showError(t("report.errorTitle"), t("report.validationDescriptionMin"));
      return;
    }

    if (description.length > 2000) {
      showError(t("report.errorTitle"), t("report.validationDescriptionMax"));
      return;
    }

    const attachmentError = attachments.validateAttachments();
    if (attachmentError === "tooMany") {
      showError(t("report.errorTitle"), t("report.tooManyAttachments"));
      return;
    }
    if (attachmentError === "tooLarge") {
      showError(t("report.errorTitle"), t("report.attachmentTooLarge"));
      return;
    }

    setIsSubmitting(true);
    const result = await submitUserReport(
      { reportedUserId, reason: reason!, description },
      attachments.appendToFormData,
    );
    setIsSubmitting(false);

    if (!result.success) {
      let body: string;
      switch (result.code) {
        case ReportingErrorCode.AlreadyReported:
          body = t("report.alreadyReported");
          break;
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
      showError(t("report.errorTitle"), body);
      return;
    }

    showNotificationToastNative({
      type: LocalToastType.CustomSystemNotice,
      customTitle: t("report.successTitle"),
      customBody: t("report.successBody"),
    });
    onSuccess?.();
  }

  return {
    reason,
    setReason,
    description,
    setDescription,
    isSubmitting,
    submit,
    attachments,
  };
}
