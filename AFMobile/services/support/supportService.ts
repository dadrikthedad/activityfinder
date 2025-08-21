import { API_BASE_URL } from "@/constants/routes";
import { ReportRequestDTO, ReportResponseDTO } from "@shared/types/report/reportDTOs";
import { PriorityEnum, ReportStatusEnum,ReportTypeEnum } from "@shared/types/report/reportEnums";
import { getCurrentDeviceInfo, getPlatform } from "@/utils/device/UserOnlineFunctions";





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
    
    const response = await fetch(`${API_BASE_URL}/api/support/report`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("🔴 Report submission failed:", errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || 'Report submission failed');
      } catch {
        throw new Error(errorText || 'Report submission failed');
      }
    }

    const data = await response.json();
    console.log("✅ Report submitted successfully:", data.reportId);
    return data;
  } catch (error) {
    console.error("❌ Error submitting report:", error);
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
export async function getBrowserInfo(): Promise<{ userAgent: string; browserVersion: string; deviceInfo: string }> {
  const userAgent = navigator.userAgent;
  
  // Simple browser detection
  let browserVersion = 'Unknown';
  if (userAgent.includes('Chrome/')) {
    const match = userAgent.match(/Chrome\/([0-9.]+)/);
    browserVersion = match ? `Chrome ${match[1]}` : 'Chrome';
  } else if (userAgent.includes('Firefox/')) {
    const match = userAgent.match(/Firefox\/([0-9.]+)/);
    browserVersion = match ? `Firefox ${match[1]}` : 'Firefox';
  } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
    browserVersion = 'Safari';
  }
  
  // Use existing device utils
  const deviceInfo = await getCurrentDeviceInfo();
  const platform = getPlatform();
  
  return {
    userAgent,
    browserVersion,
    deviceInfo: `${platform} - DeviceID: ${deviceInfo.deviceId} - Capabilities: ${deviceInfo.capabilities.join(', ')}`
  };
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
  const browserInfo = await getBrowserInfo();
  
  return {
    type: ReportTypeEnum.BugReport,
    title,
    description,
    stepsToReproduce,
    expectedBehavior,
    actualBehavior,
    priority,
    ...browserInfo
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