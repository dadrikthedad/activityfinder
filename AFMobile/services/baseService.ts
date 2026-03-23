// services/baseService.ts
// Re-eksporterer fra core/api/baseService for bakoverkompatibilitet.
// Ny kode skal importere direkte fra @/core/api/baseService
export {
  getRequest,
  postRequest,
  putRequest,
  deleteRequest,
  postFormDataRequest,
  postRequestPublic,
  getRequestPublic,
  RateLimitError,
  BannedError,
} from '@/core/api/baseService';
