// services/imageService.ts
import { postFormDataRequest } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/api/routes";
import { UploadAttachmentsRequestDTO } from "@shared/types/MessageDTO";
import { MessageDTO } from "@shared/types/MessageDTO";

// Upload profilbilde
export async function uploadProfileImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  
  const url = `${API_BASE_URL}/api/file/upload-profile-image`;
  const response = await postFormDataRequest<{ imageUrl: string }>(url, formData);
  
  if (!response) {
    throw new Error("Failed to upload profile image");
  }
  
  return response.imageUrl;
}

// Upload gruppebilde
export async function uploadGroupImage(
  file: File, 
  groupId?: number
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

console.log("🔍 SERVICE: uploadGroupImage called with groupId:", groupId);
  
    if (groupId) {
    formData.append("groupId", groupId.toString());
    console.log("🔍 SERVICE: Added groupId to FormData:", groupId.toString()); // 🆕 Legg til denne
  } else {
    console.log("🔍 SERVICE: No groupId provided, creating temp file"); // 🆕 Legg til denne
  }
 
  
    // 🔧 Test: Send groupId som query parameter i stedet
  const url = groupId 
    ? `${API_BASE_URL}/api/file/upload-group-image?groupId=${groupId}`
    : `${API_BASE_URL}/api/file/upload-group-image`;
  
  console.log("🔍 SERVICE: Final URL:", url);
  
  const response = await postFormDataRequest<{ imageUrl: string }>(url, formData);
  
  if (!response) {
    throw new Error("Failed to upload group image");
  }
  
  return response.imageUrl;
}

// Send melding med vedlegg
export async function uploadMessageAttachments(data: UploadAttachmentsRequestDTO): Promise<MessageDTO> {
  const formData = new FormData();
  
  if (data.text) formData.append("Text", data.text);
  formData.append("ConversationId", data.conversationId.toString());
  if (data.receiverId) formData.append("ReceiverId", data.receiverId);
  if (data.parentMessageId) formData.append("ParentMessageId", data.parentMessageId.toString());
  
  // Legg til alle filer
  data.files.forEach(file => formData.append("Files", file));

  const url = `${API_BASE_URL}/api/file/upload-message-attachments`;
  const response = await postFormDataRequest<MessageDTO>(url, formData);

  if (!response) {
    throw new Error("Failed to upload files and send message");
  }

  return response;
}

// Last opp filer uten å sende melding
export async function uploadFiles(
  files: File[], 
  containerName: string = "attachments"
): Promise<{ results: Array<{ fileName: string; success: boolean; fileUrl?: string; fileType?: string; error?: string }> }> {
  const formData = new FormData();
  
  files.forEach(file => formData.append("files", file));

  const url = `${API_BASE_URL}/api/file/upload-files?containerName=${containerName}`;
  const response = await postFormDataRequest<{ 
    results: Array<{ 
      fileName: string; 
      success: boolean; 
      fileUrl?: string; 
      fileType?: string; 
      error?: string 
    }> 
  }>(url, formData);

  if (!response) {
    throw new Error("Failed to upload files");
  }

  return response;
}

// Valider en fil på server
export async function validateFileOnServer(file: File): Promise<{
  message: string;
  contentType: string;
  size: number;
  sizeInMB: number;
}> {
  const formData = new FormData();
  formData.append("file", file);

  const url = `${API_BASE_URL}/api/file/validate-file`;
  const response = await postFormDataRequest<{
    message: string;
    contentType: string;
    size: number;
    sizeInMB: number;
  }>(url, formData);

  if (!response) {
    throw new Error("Failed to validate file");
  }

  return response;
}