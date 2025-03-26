export const validateFirstName = (value: string): string | null => {
    if (!value.trim()) return "First name is required.";
    if (value.length > 50) return "First name can't be more than 50 characters.";
    return null;
  };
  
  export const validateMiddleName = (value: string): string | null => {
    if (value.trim() && value.length > 50) return "Middle name can't be more than 50 characters.";
    return null;
  };
  
  export const validateLastName = (value: string): string | null => {
    if (!value.trim()) return "Last name is required.";
    if (value.length > 50) return "Last name can't be more than 50 characters.";
    return null;
  };
  
  export const validateEmail = (value: string): string | null => {
    if (!value.trim()) return "Valid email is required.";
    if (!/^\S+@\S+\.\S+$/.test(value)) return "Invalid email format.";
    if (value.length > 100) return "Email can't be more than 100 characters.";
    return null;
  };
  
  export const validatePhone = (value: string): string | null => {
    const phoneRegex = /^\+?[0-9]{7,15}$/;
    if (value.trim() && !phoneRegex.test(value)) return "Invalid phone number format.";
    if (value.length > 30) return "Phone number can't be more than 30 characters.";
    return null;
  };
  
  export const validatePassword = (value: string): string | null => {
    if (!value.trim()) return "Password is required.";
    if (value.length < 8) return "Password must be at least 8 characters long.";
    if (value.length > 128) return "Password can't be more than 128 characters.";
    if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value)) {
      return "Password must contain at least one uppercase letter, one lowercase letter, and one number.";
    }
    return null;
  };
  
  export const validateConfirmPassword = (value: string, password: string): string | null => {
    if (!value.trim()) return "Confirm password is required.";
    if (value !== password) return "Passwords do not match.";
    return null;
  };
  
  export const validateDateOfBirth = (value: string): string | null => {
    const today = new Date().toISOString().split("T")[0];
    if (!value.trim()) return "Date of birth is required.";
    if (value > today) return "Date of birth cannot be in the future.";
    return null;
  };
  
  export const validateCountry = (value: string): string | null => {
    if (!value.trim()) return "Country is required.";
    if (value.length > 100) return "Country name can't be more than 100 characters.";
  return null;
};

  
export const validateRegion = (value: string): string | null => {
    if (!value.trim() || value === "-- Choose --") {
      return "Region is required.";
    }
  
    if (value === "No regions available") {
      return null; // ✅ Godkjent hvis landet ikke har noen regioner
    }
  
    if (value.length > 100) return "Region name can't be more than 100 characters.";
  
    return null;
  };
  
  export const validatePostalCode = (value: string): string | null => {
    if (value.trim() && value.length > 25) return "Postal code can't be more than 25 characters.";
    return null;
  };

  export const validateGender = (value: string): string | null => {
    if (!value || value === "" || value === "Select Gender") return "Please select a gender.";
    if (!["Male", "Female", "Unspecified"].includes(value)) return "Invalid gender selected.";
    return null;
  };

  export type FieldName =
  | "firstName" | "middleName" | "lastName"
  | "email" | "phone"
  | "password" | "confirmPassword"
  | "dateOfBirth" | "country" | "region" | "postalCode" | "gender";
  
  export const validateSingleField = (
    name: FieldName,
    value: string,
    passwordToCompare?: string
  ): string | null => {
    switch (name) {
      case "firstName": return validateFirstName(value);
      case "middleName": return validateMiddleName(value);
      case "lastName": return validateLastName(value);
      case "email": return validateEmail(value);
      case "phone": return validatePhone(value);
      case "password": return validatePassword(value);
      case "confirmPassword": return validateConfirmPassword(value, passwordToCompare || "");
      case "dateOfBirth": return validateDateOfBirth(value);
      case "country": return validateCountry(value);
      case "region": return validateRegion(value);
      case "postalCode": return validatePostalCode(value);
      case "gender": return validateGender(value); 
      default: return null;
    }
  };