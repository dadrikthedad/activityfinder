// henter informasjon fra UserDTO.cs i backend, brukes til å vise bruker informasjon i hooken useCurrentUser som henter informasjon til securitycred
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