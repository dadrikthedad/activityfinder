import { API_BASE_URL } from "@/constants/routes";
import { postRequest } from "../baseService";

export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const url = `${API_BASE_URL}/api/user/verify-password`;
    await postRequest<any, { password: string }>(url, { password });
    return true; // Hvis ingen feil, er passordet riktig
  } catch (error) {
    return false; // Feil = feil passord
  }
}