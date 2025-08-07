// Her hetner vi userID fra token, brukes i editprofile og profile/[id] til å bekrefte om vi er eieren eller ikke
// shared
import { jwtDecode } from "jwt-decode";

type JwtPayload = {
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"?: string;
    nameid?: string;
    sub?: string;
  };

  export function getUserIdFromToken(token: string | null): number | null {
    if (!token) return null;
  
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      console.log("✅ Decoded JWT:", decoded);
  
      const userId = // Her dekoder vi fra flere mulig feltnavn, det gjør at vi er kompatible med flere JWT-standarder
        decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ||
        decoded.nameid ||
        decoded.sub;
  
      return userId ? Number(userId) : null;
    } catch (error) {
      console.error("❌ Failed to decode JWT:", error);
      return null;
    }
  }
