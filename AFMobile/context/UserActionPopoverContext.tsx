// context/UserActionPopoverContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import UserActionPopoverNative from '@/components/common/UserActionPopover/UserActionPopoverNative';

interface UserPopoverData {
  user: UserSummaryDTO;
  position: { x: number; y: number };
  isGroup?: boolean;
  participants?: UserSummaryDTO[];
  onLeaveGroup?: () => void;
  isPendingRequest?: boolean;
  conversationId?: number;
}

interface UserActionPopoverContextType {
  showPopover: (data: UserPopoverData) => void;
  hidePopover: () => void;
}

const UserActionPopoverContext = createContext<UserActionPopoverContextType | undefined>(undefined);

interface UserActionPopoverProviderProps {
  children: ReactNode;
}

export function UserActionPopoverProvider({ children }: UserActionPopoverProviderProps) {
  const [popoverState, setPopoverState] = useState<{
    visible: boolean;
    data: UserPopoverData | null;
  }>({
    visible: false,
    data: null,
  });

  const showPopover = (data: UserPopoverData) => {
    setPopoverState({
      visible: true,
      data,
    });
  };

  const hidePopover = () => {
    setPopoverState({
      visible: false,
      data: null,
    });
  };

  return (
    <UserActionPopoverContext.Provider value={{ showPopover, hidePopover }}>
      {children}
      
      {/* Render popover when visible */}
      {popoverState.visible && popoverState.data && (
        <UserActionPopoverNative
          user={popoverState.data.user}
          visible={popoverState.visible}
          onClose={hidePopover}
          position={popoverState.data.position}
          isGroup={popoverState.data.isGroup}
          participants={popoverState.data.participants}
          onLeaveGroup={popoverState.data.onLeaveGroup}
          isPendingRequest={popoverState.data.isPendingRequest}
          conversationId={popoverState.data.conversationId}
        />
      )}
    </UserActionPopoverContext.Provider>
  );
}

export function useUserActionPopover() {
  const context = useContext(UserActionPopoverContext);
  if (context === undefined) {
    throw new Error('useUserActionPopover must be used within a UserActionPopoverProvider');
  }
  return context;
}