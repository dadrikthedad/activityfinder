// features/messages/services/userSearchService.ts
// Brukersøk for NewMessage. Beholder bruker-ID som GUID-streng (i motsetning til den
// eldre navbar-søke-servicen som caster til number).

import { getRequest } from "@/core/api/baseService";
import { ApiRoutes } from "@/core/api/routes";
import { Result } from "@/core/errors/Result";
import { MessagingErrorCode } from "@/core/errors/ErrorCode";
import { UserSearchResultDTO } from "../models/UserSearchResultDTO";
import { mapMessagingError } from "./mapMessagingError";

// Speil av SearchUsersResponse.cs / UserSearchResult.cs i AFBack
interface QuickSearchResponse {
  users: Array<{
    id: string;
    fullName: string;
    profileImageUrl: string | null;
    countryCode: string | null;
    proximityLevel: number;
  }>;
  nextCursor: string | null;
  hasMore: boolean;
}

export async function searchUsers(
  query: string,
): Promise<Result<UserSearchResultDTO[], MessagingErrorCode>> {
  try {
    const data = await getRequest<QuickSearchResponse>(ApiRoutes.search.usersQuick(query));
    const users: UserSearchResultDTO[] = (data?.users ?? []).map((u) => ({
      id: u.id,
      fullName: u.fullName,
      profileImageUrl: u.profileImageUrl,
      countryCode: u.countryCode,
      proximityLevel: u.proximityLevel,
    }));
    return Result.ok(users);
  } catch (error) {
    return mapMessagingError(error);
  }
}
