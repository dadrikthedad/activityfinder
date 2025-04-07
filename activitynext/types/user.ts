// henter informasjon fra UserDTO
export interface User {
    userId: number;
    fullName: string;
    email: string;
    phone?: string;
    dateOfBirth: string;
    country: string;
    region?: string;
    postalCode?: string;
    gender: "Male" | "Female" | "Unspecified";
  }