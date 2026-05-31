export const STORAGE_TYPE = {
  AES_GCM_NO_AUTH: 'AES_GCM_NO_AUTH',
  RSA: 'RSA',
  AES: 'AES',
};

export const setInternetCredentials = jest.fn().mockResolvedValue(true);
export const getInternetCredentials = jest.fn().mockResolvedValue(false);
export const resetInternetCredentials = jest.fn().mockResolvedValue(true);

export const setGenericPassword = jest.fn().mockResolvedValue(true);
export const getGenericPassword = jest.fn().mockResolvedValue(false);
export const resetGenericPassword = jest.fn().mockResolvedValue(true);
