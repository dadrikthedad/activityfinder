import { AttachmentDto } from "@shared/types/MessageDTO";

export function getAttachmentSummary(attachments: AttachmentDto[]): string {
  if (!attachments || attachments.length === 0) return "";

  const imageCount = attachments.filter(att => att.fileType?.startsWith('image/')).length;
  const videoCount = attachments.filter(att => att.fileType?.startsWith('video/')).length;
  const pdfCount = attachments.filter(att => att.fileType === 'application/pdf').length;
  const docCount = attachments.filter(att => 
    att.fileType?.includes('word') || 
    att.fileName?.toLowerCase().endsWith('.docx') || 
    att.fileName?.toLowerCase().endsWith('.doc')
  ).length;
  const otherCount = attachments.length - imageCount - videoCount - pdfCount - docCount;

  const parts = [];
  if (imageCount > 0) parts.push(`${imageCount} image${imageCount !== 1 ? 's' : ''}`);
  if (videoCount > 0) parts.push(`${videoCount} video${videoCount !== 1 ? 's' : ''}`);
  if (pdfCount > 0) parts.push(`${pdfCount} PDF${pdfCount !== 1 ? 's' : ''}`);
  if (docCount > 0) parts.push(`${docCount} document${docCount !== 1 ? 's' : ''}`);
  if (otherCount > 0) parts.push(`${otherCount} file${otherCount !== 1 ? 's' : ''}`);

  if (parts.length === 0) return "";
  
  const total = attachments.length;
  if (total === 1) {
    return ` ${parts[0]}`;
  } else {
    return ` ${total} files (${parts.join(', ')})`;
  }
}