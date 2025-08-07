// Hvordan bruke GroupSettings på React Native

// 1. Med din eksisterende ModalContext
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useModal } from '@/context/ModalContext';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import GroupSettingsModalNative from './GroupSettingsModalNative';

interface GroupChatHeaderProps {
  user: UserSummaryDTO;
  conversationId: number;
}

export default function GroupChatHeader({ user, conversationId }: GroupChatHeaderProps) {
  const { showModal, hideModal } = useModal();

  const openGroupSettings = () => {
    showModal(
      <GroupSettingsModalNative
        visible={true}
        user={user}
        conversationId={conversationId}
        onClose={hideModal}
      />,
      {
        blurBackground: false, // Modal håndterer sitt eget blur
        dismissOnBackdrop: false, // La modal håndtere close selv
      }
    );
  };

  return (
    <TouchableOpacity onPress={openGroupSettings}>
      <Text>Group Settings ⚙️</Text>
    </TouchableOpacity>
  );
}

