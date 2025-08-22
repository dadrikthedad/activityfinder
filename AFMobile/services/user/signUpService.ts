
import { API_BASE_URL } from "@/constants/routes";
import { RegisterResponse } from "@shared/types/auth/RegisterResponseDTO";
import { RegisterUserPayload } from "@shared/types/auth/RegisterUserPayloadDTO";


export async function checkEmailAvailability(email: string): Promise<boolean> {
  try {
    console.log("🟡 Checking email availability for:", email);
    
    const normalized = email.trim().toLowerCase();
    const response = await fetch(`${API_BASE_URL}/api/user/check-email?email=${encodeURIComponent(normalized)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json() as { exists: boolean };
    console.log("✅ Email check result:", { email: normalized, exists: data.exists, available: !data.exists });
    
    return !data.exists; // true = tilgjengelig, false = opptatt
  } catch (error) {
    console.error("❌ Error checking email availability:", error);
    // Ved feil, returner false (ikke tilgjengelig) for sikkerhet
    return false;
  }
}


// Type for land
export interface Country {
  code: string;
  name: string;
}

// Type for select-option
export interface SelectOption {
  label: string;
  value: string;
}

// Henter land - bruker fetchWithAuth uten token (offentlig endpoint)
export async function fetchCountries(): Promise<Country[]> {
  try {
    console.log("🟡 Fetching countries from:", `${API_BASE_URL}/api/user/countries`);
    
    const response = await fetch(`${API_BASE_URL}/api/user/countries`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Countries fetched successfully:", data);
    return data || [];
  } catch (error) {
    console.error("❌ Error fetching countries:", error);
    return [];
  }
}

// 🔧 Henter regioner - OFFENTLIG endpoint (vanlig fetch)
export async function fetchRegions(code: string): Promise<string[]> {
  try {
    console.log("🟡 Fetching regions for country:", code);
    
    const response = await fetch(`${API_BASE_URL}/api/user/regions/${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Regions fetched successfully:", data);
    return data || [];
  } catch (error) {
    console.error("❌ Error fetching regions:", error);
    return [];
  }
}

// 🔧 Registerer bruker - OFFENTLIG endpoint (vanlig fetch)
export async function registerUserAPI(payload: RegisterUserPayload): Promise<RegisterResponse> {
  try {
    console.log("🟡 Registering user:", payload.email);
   
    const response = await fetch(`${API_BASE_URL}/api/user/register`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("🔴 Registration failed:", data);
      
      // Handle different types of errors (samme som web-versjonen)
      if (data.errors) {
        // Validation errors - format them nicely
        const errorMessages = Object.entries(data.errors as Record<string, string[]>)
          .map(([field, messages]) => 
            `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`
          )
          .join('\n');
        throw new Error(errorMessages);
      } else {
        // Single error message
        throw new Error(data.message || "User registration failed");
      }
    }
    
    console.log("✅ User registered successfully");
    return data as RegisterResponse;
  } catch (error) {
    console.error("❌ Error registering user:", error);
    throw error;
  }
}