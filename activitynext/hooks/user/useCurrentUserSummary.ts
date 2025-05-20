'use client'

import useSWR from 'swr'
import { getCurrentUserSummary } from '@/services/user/getCurrentUserSummary'
import { UserSummaryDTO } from '@/types/UserSummaryDTO'

export function useCurrentUserSummary() {
  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useSWR<UserSummaryDTO | null>(
    // 1) Bruk en array som nøkkel, ikke bare string
    ['/user/summary'],
    // 2) Pakk fetcheren inn i en arrow-funksjon så den matcher signaturen
    () => getCurrentUserSummary(),
    {
      revalidateOnFocus: true, // eller false om du vil
    }
  )

  return {
    user: data ?? null,
    loading: isLoading,
    error,
    refresh,
  }
}