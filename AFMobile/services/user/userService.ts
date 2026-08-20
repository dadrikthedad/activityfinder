import { postRequest } from "../baseService";
import { ApiRoutes } from "@/core/api/routes";

export async function verifyPassword(password: string): Promise<boolean> {
  try {
    await postRequest<void, { password: string }>(ApiRoutes.auth.verifyPassword, { password });
    return true;
  } catch {
    return false;
  }
}