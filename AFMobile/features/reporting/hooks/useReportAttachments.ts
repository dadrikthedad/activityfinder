import { useState } from "react";
import { RNFile } from "@/utils/files/FileFunctions";

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export interface ReportAttachment extends RNFile {}

export function useReportAttachments() {
  const [attachments, setAttachments] = useState<ReportAttachment[]>([]);

  function addAttachments(incoming: RNFile[]) {
    setAttachments((prev) => {
      const merged = [...prev, ...incoming];
      return merged.slice(0, MAX_ATTACHMENTS);
    });
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function validateAttachments(): string | null {
    if (attachments.length > MAX_ATTACHMENTS) return "tooMany";
    const oversized = attachments.some((f) => (f.size ?? 0) > MAX_FILE_SIZE);
    if (oversized) return "tooLarge";
    return null;
  }

  function appendToFormData(formData: FormData) {
    for (const file of attachments) {
      formData.append("attachments", {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as unknown as Blob);
    }
  }

  return {
    attachments,
    addAttachments,
    removeAttachment,
    validateAttachments,
    appendToFormData,
    canAddMore: attachments.length < MAX_ATTACHMENTS,
  };
}
