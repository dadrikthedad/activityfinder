// Her kan vi hente alle api-kall med fetchWithAuth, alt vi trenger er å gi riktig url
import { fetchWithAuth } from "@/utils/api/fetchWithAuth";

export async function getRequest<T>(url: string): Promise<T | null> {
    return await fetchWithAuth<T>(url);
  }
  
  export async function postRequest<T, D = Record<string, unknown>>(url: string, data?: D): Promise<T | null> {
    return await fetchWithAuth<T>(url, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  
  export async function putRequest<T, D = Record<string, unknown>>(url: string, data?: D): Promise<T | null> {
    return await fetchWithAuth<T>(url, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  
  export async function deleteRequest<T>(url: string): Promise<T | null> {
    return await fetchWithAuth<T>(url, {
      method: "DELETE",
    });
  }

  // Bilder
  export async function postFormDataRequest<T>(url: string, formData: FormData): Promise<T | null> {
    return await fetchWithAuth<T>(url, {
      method: "POST",
      body: formData,
    });
  }
