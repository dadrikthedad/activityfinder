const authServiceNative = {
  getCurrentUserId: jest.fn().mockResolvedValue(null),
  isAuthenticated: jest.fn().mockResolvedValue(false),
  getAccessToken: jest.fn().mockReturnValue(null),
};

export default authServiceNative;
