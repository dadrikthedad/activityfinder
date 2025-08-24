import { API_BASE_URL } from "@/constants/routes";
import { ReportRequestDTO } from "@shared/types/report/reportDTOs";
import { PriorityEnum, ReportTypeEnum } from "@shared/types/report/reportEnums";
import { getCurrentDeviceInfo, getPlatform } from "@/utils/device/UserOnlineFunctions";
import { fetchWithAuth } from "@/utils/api/fetchWithAuth.native";
import { postRequestPublic } from "../baseService";

// Response for submit report (matches backend response)
interface SubmitReportResponse {
  ReportId: string; // ✅ Matche backend property navn
  Message: string;
  SubmittedAt: string;
}

// Submit report - Prøver først med auth, fallback til public
export async function submitReport(payload: ReportRequestDTO): Promise<SubmitReportResponse> {
  try {
    console.log("🟡 Submitting report:", payload.title);
    
    // ✅ Prøv først med auth (automatisk device headers + userId fra token)
    const response = await fetchWithAuth<SubmitReportResponse>(
      `${API_BASE_URL}/api/support/report`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    if (!response) {
      throw new Error("Failed to submit report - no response received");
    }

    console.log("✅ Authenticated report submitted successfully:", response.ReportId);
    return response;
  } catch (error) {
    console.error("❌ Error submitting authenticated report:", error);
    
    // ✅ Hvis "No auth token found", bruk public endpoint (anonymous med device headers)
    if (error instanceof Error && error.message === "No auth token found.") {
      console.log("ℹ️ No token found, submitting as anonymous report with device headers");
      
      try {
        const response = await postRequestPublic<SubmitReportResponse, ReportRequestDTO>(
          `${API_BASE_URL}/api/support/report`,
          payload
        );

        if (!response) {
          throw new Error("Failed to submit anonymous report - no response received");
        }

        console.log("✅ Anonymous report submitted successfully:", response.ReportId);
        return response;
      } catch (publicError) {
        console.error("❌ Error submitting anonymous report:", publicError);
        throw publicError;
      }
    }
    
    throw error;
  }
}

// Helper function to auto-detect device info for reports
export async function getDeviceInfoForReport(): Promise<{ 
  UserAgent: string; 
  BrowserVersion: string; 
  DeviceInfo: string 
}> {
  try {
    // Use existing device utils
    const deviceInfo = await getCurrentDeviceInfo();
    
    // Create React Native specific user agent
    const UserAgent = `ReactNative/${deviceInfo.platform} - DeviceID: ${deviceInfo.deviceId}`;
    
    // For React Native, "browser" is the app itself
    const BrowserVersion = `ReactNative App - ${deviceInfo.platform}`;
    
    // Device info string
    const DeviceInfo = `${deviceInfo.platform} - DeviceID: ${deviceInfo.deviceId} - Capabilities: ${deviceInfo.capabilities.join(', ')} - Network: ${deviceInfo.networkInfo.type} (Connected: ${deviceInfo.networkInfo.isConnected})`;
    
    return {
      UserAgent,
      BrowserVersion,
      DeviceInfo
    };
  } catch (error) {
    console.error('Error getting device info for report:', error);
    
    // Fallback to basic Platform info if device utils fail
    const platform = getPlatform();
    return {
      UserAgent: `ReactNative/${platform}`,
      BrowserVersion: `ReactNative App - ${platform}`,
      DeviceInfo: `${platform}`
    };
  }
}

// Helper function to create bug report with auto-filled device info
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
    title: title,
    description: description,
    stepsToReproduce: stepsToReproduce,
    expectedBehavior: expectedBehavior,
    actualBehavior: actualBehavior,
    priority: priority,
    userAgent: deviceInfo.UserAgent,
    browserVersion: deviceInfo.BrowserVersion,
    deviceInfo: deviceInfo.DeviceInfo
  };
}

// Helper function to create user report
export async function createUserReportPayload(
  title: string,
  description: string,
  reportedUserId: string,
  priority: PriorityEnum = PriorityEnum.Medium
): Promise<ReportRequestDTO> {
  const deviceInfo = await getDeviceInfoForReport();
  
  return {
    type: ReportTypeEnum.UserReport,
    title: title,
    description: description,
    reportedUserId: reportedUserId,
    priority: priority,
    userAgent: deviceInfo.UserAgent,
    browserVersion: deviceInfo.BrowserVersion,
    deviceInfo: deviceInfo.DeviceInfo
  };
}