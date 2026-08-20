import { fetchWithAuth } from "@/utils/api/fetchWithAuthNative";
import { API_BASE_URL } from "@/constants/routes";
import { UserSummaryDTO } from "@shared/types/UserSummaryDTO";
import { Result } from "@/core/errors/Result";
import { SearchErrorCode } from "@/core/errors/ErrorCode";
import { ApiError } from "@/core/errors/ProblemDetails";

interface UserSearchResult {
  id: string;
  fullName: string;
  profileImageUrl: string | null;
  countryCode: string | null;
  proximityLevel: number;
}

interface QuickSearchResponse {
  users: UserSearchResult[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function searchUsers(query: string): Promise<Result<UserSummaryDTO[], SearchErrorCode>> {
  const url = `${API_BASE_URL}/api/search/users/quick?SearchQuery=${encodeURIComponent(query)}`;
  try {
    const data = await fetchWithAuth<QuickSearchResponse>(url);
    console.log("🔍 searchUsers response:", JSON.stringify(data));
    const users: UserSummaryDTO[] = (data?.users ?? []).map((u) => ({
      id: u.id,
      fullName: u.fullName,
      profileImageUrl: u.profileImageUrl,
    }));
    console.log("🔍 mapped users:", users.length);
    return Result.ok(users);
  } catch (error: unknown) {
    console.error("🔴 searchUsers error:", error);
    return mapSearchError(error);
  }
}

function mapSearchError(error: unknown): Result<UserSummaryDTO[], SearchErrorCode> {
  if (error instanceof ApiError) {
    if (error.status >= 500)
      return Result.fail("Server error. Please try again.", SearchErrorCode.ServerError);
    return Result.fail(error.message, SearchErrorCode.Unknown);
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch"))
      return Result.fail("Network error. Please check your connection.", SearchErrorCode.NetworkError);
    return Result.fail(error.message, SearchErrorCode.Unknown);
  }
  return Result.fail("An unexpected error occurred.", SearchErrorCode.Unknown);
}
