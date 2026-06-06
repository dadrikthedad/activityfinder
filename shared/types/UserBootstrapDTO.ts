export interface UserBootstrapDTO {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  profileImageUrl: string | null;
  email: string | null;
  phoneNumber: string | null;
  createdAt: string;
  onBoardingCompletedAt: string | null;
}
