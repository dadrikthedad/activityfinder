export interface User {
    fullName: string;
    email: string;
    phone?: string;
    dateOfBirth: string;
    country: string;
    region?: string;
    postalCode?: string;
    gender: "Male" | "Female" | "Unspecified";
  }