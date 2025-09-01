import { useState, useEffect, useCallback } from 'react';
import { FriendInvitationDTO } from '@shared/types/FriendInvitationDTO';
import { getRejectedFriendInvitations } from '@/services/friends/friendService';
import authServiceNative from "@/services/user/authServiceNative";

export function useGetRejectedFriendInvitations() {
  const [rejectedInvitations, setRejectedInvitations] = useState<FriendInvitationDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRejectedInvitations = useCallback(async () => {
    const token = await authServiceNative.getAccessToken();
    if (!token) {
      setError('No authentication token');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await getRejectedFriendInvitations(token);
      setRejectedInvitations(data);
    } catch (err) {
      console.error('❌ Error fetching rejected friend invitations:', err);
      setError('Failed to load rejected friend invitations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRejectedInvitations();
  }, [fetchRejectedInvitations]);

  const refetch = useCallback(() => {
    fetchRejectedInvitations();
  }, [fetchRejectedInvitations]);

  return {
    rejectedInvitations,
    isLoading,
    error,
    refetch,
  };
}