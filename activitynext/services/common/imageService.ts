// services/imageService.ts
import { postFormDataRequest } from "@/services/baseService";
import { API_BASE_URL } from "@/constants/routes";

// Upload profilbilde
export async function uploadProfileImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  
  const url = `${API_BASE_URL}/api/image/upload-profile-image`;
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
  
  if (groupId) {
    formData.append("groupId", groupId.toString());
  }
  
  const url = `${API_BASE_URL}/api/image/upload-group-image`;
  const response = await postFormDataRequest<{ imageUrl: string }>(url, formData);
  
  if (!response) {
    throw new Error("Failed to upload group image");
  }
  
  return response.imageUrl;
}