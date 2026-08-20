// features/conversation/components/PendingRequestsListNative.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { usePendingMessageRequests } from '@/hooks/messages/usePendingMessageRequests';
import { useApproveMessageRequest } from '@/hooks/messages/useApproveMessageRequest';
import { useRejectMessageRequest } from '@/hooks/messages/useRejectMessageRequest';
import { useConfirmModalNative } from '@/hooks/useConfirmModalNative';
import { ConversationDTO } from '@shared/types/ConversationDTO';
import { UserSummaryDTO } from '@shared/types/UserSummaryDTO';
import { ConversationListItemNative } from './ConversationListItemNative';
import { PendingRequestActionsNative } from './PendingRequestActionsNative';
import { isGroupConversation, getOtherParticipant } from '@/features/conversation/utils/conversationHelpers';
import { useCurrentUser } from '@/store/useUserCacheStore';
import ButtonNative from '@/components/common/buttons/ButtonNative';

type AppTheme = ReturnType<typeof useUnistyles>['theme'];

interface PendingRequestsListNativeProps {
  limit?: number;
  showMoreLink?: boolean;
  onSelectConversation: (conversationId: number) => void;
  onShowMore?: () => void; // Prop for "Se mer"-funksjonalitet
  navigation: any;
}

export function PendingRequestsListNative({
  limit,
  showMoreLink = false,
  onSelectConversation,
  onShowMore,
  navigation,
}: PendingRequestsListNativeProps) {
  const { requests, isLoading, error, removeRequest } = usePendingMessageRequests();

  const { approve } = useApproveMessageRequest();
  const { reject } = useRejectMessageRequest();
  const { confirm } = useConfirmModalNative();
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Sporer hvilken konkret forespørsel som behandles nå.
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(null);
  const [processingType, setProcessingType] = useState<'approve' | 'reject' | null>(null);

  const currentUser = useCurrentUser();

  // Utleder visningsdata (navn/avatar/deltakere) fra ConversationDTO via helperne.
  const deriveDisplay = (c: ConversationDTO) => {
    const group = isGroupConversation(c);
    const other = getOtherParticipant(c, currentUser?.id);
    const user: UserSummaryDTO = group
      ? { id: String(c.id), fullName: c.groupName ?? t('conversation.unknownGroup'), profileImageUrl: c.groupImageUrl ?? null }
      : other?.user ?? { id: String(c.id), fullName: t('conversation.unknownUser'), profileImageUrl: null };
    const participants = c.participants.map((p) => p.user);
    return { group, user, participants };
  };

  const handleReject = async (c: ConversationDTO) => {
    const { group, user } = deriveDisplay(c);

    const title = group
      ? t('conversation.rejectGroupTitle')
      : t('conversation.rejectMessageTitle');

    let message: string;
    if (group) {
      message = c.groupName
        ? t('conversation.rejectGroupConfirmNamed', { name: user.fullName, groupName: c.groupName })
        : t('conversation.rejectGroupConfirm', { name: user.fullName });
    } else {
      message = t('conversation.rejectMessageConfirm', { name: user.fullName });
    }

    const confirmed = await confirm({ title, message });

    if (confirmed) {
      setProcessingRequestId(c.id);
      setProcessingType('reject');

      try {
        await reject(c.id);
        removeRequest(c.id);
      } catch (error) {
        console.error('Error rejecting request:', error);
      } finally {
        setProcessingRequestId(null);
        setProcessingType(null);
      }
    }
  };

  const handleApprove = async (c: ConversationDTO) => {
    setProcessingRequestId(c.id);
    setProcessingType('approve');

    try {
      await approve(c.id);
      removeRequest(c.id);
    } catch (error) {
      console.error('Error approving request:', error);
    } finally {
      setProcessingRequestId(null);
      setProcessingType(null);
    }
  };

  // Sjekker om en gitt forespørsel behandles akkurat nå.
  const isRequestProcessing = (conversationId: number) => {
    return processingRequestId === conversationId;
  };

  const renderPendingRequest = ({ item: c }: { item: ConversationDTO }) => {
    const { group, user, participants } = deriveDisplay(c);
    const memberCount = group ? (participants.length > 0 ? participants.length : 2) : undefined;
    const isProcessing = isRequestProcessing(c.id);

    return (
      <View style={styles.pendingRequestContainer}>
        {/* Loading overlay */}
        {isProcessing && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContent}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.loadingOverlayText}>
                {processingType === 'approve'
                  ? t('conversation.pendingAccepting')
                  : t('conversation.pendingDeclining')}
              </Text>
            </View>
          </View>
        )}

        {/* Hovedcontainer med samtale og knapper side ved side */}
        <View style={[styles.conversationWithActions, isProcessing && styles.processingRequest]}>
          {/* Samtalekortet - tar opp mesteparten av plassen */}
          <View style={styles.conversationSection}>
            <ConversationListItemNative
              user={user}
              isClickable={!isProcessing}
              isPendingApproval={true}
              onClick={() => {
                if (!isProcessing) {
                  onSelectConversation(c.id);
                }
              }}
              isGroup={group}
              memberCount={memberCount}
              participants={participants}
              navigation={navigation}
            />
          </View>

          {/* Godkjenn/avslå-knapper til høyre */}
          <PendingRequestActionsNative
            onApprove={() => handleApprove(c)}
            onReject={() => handleReject(c)}
            isProcessing={isProcessing}
            processingType={processingType}
          />
        </View>
      </View>
    );
  };

  if (isLoading && requests.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('conversation.pendingEmpty')}</Text>
      </View>
    );
  }

  const visibleRequests = limit ? requests.slice(0, limit) : requests;

  return (
    <View style={styles.pendingContainer}>
      <Text style={styles.pendingHeader}>
        {t('conversation.pendingHeader', { count: requests.length })}
      </Text>
      <FlashList
        data={visibleRequests}
        renderItem={renderPendingRequest}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!processingRequestId} // Deaktiver scrolling ved behandling
      />

      {showMoreLink && requests.length > (limit ?? 0) && (
        <View style={styles.showMoreContainer}>
          <ButtonNative
            text={t('conversation.pendingSeeMore')}
            onPress={onShowMore || (() => {})}
            variant="primary"
            size="small"
            style={{ alignSelf: 'center' }}
            disabled={!!processingRequestId} // Deaktiver "Se mer" ved behandling
          />
        </View>
      )}
    </View>
  );
}

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    pendingContainer: {},
    pendingHeader: {
      fontSize: theme.typography.md,
      fontWeight: theme.typography.semibold,
      color: theme.colors.textPrimary,
      paddingHorizontal: theme.spacing.md,
    },
    pendingRequestContainer: {
      position: 'relative',
    },
    conversationWithActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    processingRequest: {
      opacity: 0.6,
    },
    conversationSection: {
      flex: 1, // Tar opp mesteparten av plassen
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.background + 'CC', // Halvgjennomsiktig scrim som følger temaet
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    loadingContent: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    loadingOverlayText: {
      marginLeft: theme.spacing.sm,
      fontSize: theme.typography.sm,
      fontWeight: theme.typography.medium,
      color: theme.colors.primary,
    },
    showMoreContainer: {
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
    },
    errorContainer: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    errorText: {
      fontSize: theme.typography.sm,
      color: theme.colors.error,
    },
    emptyContainer: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    emptyText: {
      fontSize: theme.typography.sm,
      color: theme.colors.textMuted,
    },
  });
