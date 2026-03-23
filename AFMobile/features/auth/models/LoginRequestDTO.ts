// features/auth/models/LoginRequestDTO.ts
// Tilsvarer LoginRequest i AFBack
import { DeviceInfoRequest } from "@/core/models/DeviceInfoRequest";

export interface LoginRequest {
  email: string;
  password: string;
  device: DeviceInfoRequest;
}
