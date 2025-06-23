import { useState } from 'react';
import { getGroupApprovedMembers } from '@/services/messages/messageNotificationService';
import { GroupApprovedMember } from '@/types/GroupApprovedMemberDTO';

export function useGroupMembers() {
  const [members, setMembers] = useState<GroupApprovedMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroupMembers = async (conversationId: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getGroupApprovedMembers(conversationId);
      
      if (data) {
        setMembers(data);
      } else {
        setMembers([]);
        setError('Failed to fetch group members');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    members,
    loading,
    error,
    fetchGroupMembers
  };
}