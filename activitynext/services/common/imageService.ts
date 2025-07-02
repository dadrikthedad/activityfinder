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

console.log("🔍 SERVICE: uploadGroupImage called with groupId:", groupId);
  
    if (groupId) {
    formData.append("groupId", groupId.toString());
    console.log("🔍 SERVICE: Added groupId to FormData:", groupId.toString()); // 🆕 Legg til denne
  } else {
    console.log("🔍 SERVICE: No groupId provided, creating temp file"); // 🆕 Legg til denne
  }
 
  
    // 🔧 Test: Send groupId som query parameter i stedet
  const url = groupId 
    ? `${API_BASE_URL}/api/image/upload-group-image?groupId=${groupId}`
    : `${API_BASE_URL}/api/image/upload-group-image`;
  
  console.log("🔍 SERVICE: Final URL:", url);
  
  const response = await postFormDataRequest<{ imageUrl: string }>(url, formData);
  
  if (!response) {
    throw new Error("Failed to upload group image");
  }
  
  return response.imageUrl;
}