import { API_BASE_URL } from "@/constants/routes";
import { ReportRequestDTO, ReportResponseDTO } from "@shared/types/report/reportDTOs";
import { PriorityEnum, ReportStatusEnum,ReportTypeEnum } from "@shared/types/report/reportEnums";
import { getCurrentDeviceInfo, getPlatform } from "@/utils/device/UserOnlineFunctions";
import { getUserIdFromToken } from "@/utils/auth/getUserIdFromToken";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";






// Response for submit report
interface SubmitReportResponse {
  reportId: string;
  message: string;
  submittedAt: string;
}


// Submit report - OFFENTLIG endpoint (kan brukes uten login)
export async function submitReport(payload: ReportRequestDTO): Promise<SubmitReportResponse> {
  try {
    console.log("🟡 Submitting report:", payload.title);
    
    const response = await fetchWithAuth<SubmitReportResponse>(
      `${API_BASE_URL}/api/support/report`,
      {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    // Sjekk for null response
    if (!response) {
      throw new Error("Failed to submit report - no response received");
    }

    console.log("✅ Report submitted successfully:", response.reportId);
    return response;
  } catch (error) {
    console.error("❌ Error submitting report:", error);
    
    // Hvis det er "No auth token found", prøv anonymous
    if (error instanceof Error && error.message === "No auth token found.") {
      console.log("ℹ️ No token found, submitting as anonymous report");
      
      const fallbackResponse = await fetch(`${API_BASE_URL}/api/support/report`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!fallbackResponse.ok) {
        const errorText = await fallbackResponse.text();
        throw new Error(errorText || 'Anonymous report submission failed');
      }

      const data = await fallbackResponse.json();
      return data;
    }
    
    throw error;
  }
}

// Get specific report - Krever login (må sende token)
export async function getReport(reportId: string, token: string): Promise<ReportResponseDTO> {
  try {
    console.log("🟡 Fetching report:", reportId);
    
    const response = await fetch(`${API_BASE_URL}/api/support/report/${reportId}`, {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("🔴 Failed to fetch report:", errorText);
      
      if (response.status === 404) {
        throw new Error('Report not found');
      }
      if (response.status === 401) {
        throw new Error('Unauthorized - please log in');
      }
      
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || 'Failed to fetch report');
      } catch {
        throw new Error(errorText || 'Failed to fetch report');
      }
    }

    const data = await response.json();
    console.log("✅ Report fetched successfully");
    return data;
  } catch (error) {
    console.error("❌ Error fetching report:", error);
    throw error;
  }
}

// Get user's reports - Krever login
export async function getMyReports(token: string): Promise<ReportResponseDTO[]> {
  try {
    console.log("🟡 Fetching user reports");
    
    const response = await fetch(`${API_BASE_URL}/api/support/my-reports`, {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("🔴 Failed to fetch user reports:", errorText);
      
      if (response.status === 401) {
        throw new Error('Unauthorized - please log in');
      }
      
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || 'Failed to fetch reports');
      } catch {
        throw new Error(errorText || 'Failed to fetch reports');
      }
    }

    const data = await response.json();
    console.log("✅ User reports fetched successfully:", data.length, "reports");
    return data;
  } catch (error) {
    console.error("❌ Error fetching user reports:", error);
    throw error;
  }
}

// Helper function to auto-detect browser/device info using existing utils
export async function getDeviceInfoForReport(): Promise<{ 
  userAgent: string; 
  browserVersion: string; 
  deviceInfo: string 
}> {
  try {
    // Use existing device utils - this already includes platform info
    const deviceInfo = await getCurrentDeviceInfo();
    
    // Create React Native specific user agent
    const userAgent = `ReactNative/${deviceInfo.platform} - DeviceID: ${deviceInfo.deviceId}`;
    
    // For React Native, "browser" is the app itself
    const browserVersion = `ReactNative App - ${deviceInfo.platform}`;
    
    // Device info string using the structure from getCurrentDeviceInfo
    const deviceInfoString = `${deviceInfo.platform} - DeviceID: ${deviceInfo.deviceId} - Capabilities: ${deviceInfo.capabilities.join(', ')} - Network: ${deviceInfo.networkInfo.type} (Connected: ${deviceInfo.networkInfo.isConnected})`;
    
    return {
      userAgent,
      browserVersion,
      deviceInfo: deviceInfoString
    };
  } catch (error) {
    console.error('Error getting device info for report:', error);
    
    // Fallback to basic Platform info if device utils fail
    const platform = getPlatform();
    return {
      userAgent: `ReactNative/${platform}`,
      browserVersion: `ReactNative App - ${platform}`,
      deviceInfo: `${platform}`
    };
  }
}

// Helper function to create bug report with auto-filled browser info
export async function createBugReportPayload(
  title: string,
  description: string,
  stepsToReproduce?: string,
  expectedBehavior?: string,
  actualBehavior?: string,
  priority: PriorityEnum = PriorityEnum.Medium
): Promise<ReportRequestDTO> {
  const deviceInfo = await getDeviceInfoForReport();
  
  return {
    type: ReportTypeEnum.BugReport,
    title,
    description,
    stepsToReproduce,
    expectedBehavior,
    actualBehavior,
    priority,
    ...deviceInfo
  };
}

// Helper function to create user report
export function createUserReportPayload(
  title: string,
  description: string,
  reportedUserId: string,
  priority: PriorityEnum = PriorityEnum.Medium
): ReportRequestDTO {
  return {
    type: ReportTypeEnum.UserReport,
    title,
    description,
    reportedUserId,
    priority
  };
}