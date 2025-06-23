// components/notifications/GroupMembersTooltip.tsx
import { useEffect } from 'react';
import { useGroupMembers } from '@/hooks/messages/useGroupMembers';
import MiniAvatar from '../common/MiniAvatar';

interface GroupMembersTooltipProps {
  conversationId: number;
  isVisible: boolean;
}

export default function GroupMembersTooltip({ 
  conversationId, 
  isVisible, 
}: GroupMembersTooltipProps) {
  const { members, loading, error, fetchGroupMembers } = useGroupMembers();

  useEffect(() => {
    if (isVisible && conversationId) {
      fetchGroupMembers(conversationId);
    }
  }, [isVisible, conversationId]);

  if (!isVisible) return null;

  return (
    <div className="absolute z-50 bg-[#2e2e2e] dark:bg-gray-[#2e2e2e] border border-[#1C6B1C] dark:border-[#1C6B1C] rounded-lg shadow-lg p-3 min-w-[200px] max-w-[300px]">

      
      <h4 className="font-semibold text-sm mb-2 text-gray-800 dark:text-gray-200">
        Group Members
      </h4>
      
      {loading && (
        <p className="text-xs text-gray-500">Loading...</p>
      )}
      
      {error && (
        <p className="text-xs text-red-500">Error: {error}</p>
      )}
      
      {!loading && !error && members.length === 0 && (
        <p className="text-xs text-gray-500">No members found</p>
      )}
      
      {!loading && !error && members.length > 0 && (
        <ul className="space-y-1 max-h-[200px] overflow-y-auto">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center space-x-2 py-1">
              <MiniAvatar
                imageUrl={member.profileImageUrl || "/default-avatar.png"}
                size={24}
                alt={member.fullName}
                withBorder={false}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                  {member.fullName}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(member.joinedAt).toLocaleDateString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}