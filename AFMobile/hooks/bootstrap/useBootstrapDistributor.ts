import { useCallback } from 'react';
import { CriticalBootstrapResponseDTO } from '@shared/types/bootstrap/CriticalBootstrapResponseDTO';
import { SecondaryBootstrapResponseDTO } from '@shared/types/bootstrap/SecondaryBootstrapResponseDTO';
import { MessageDTO } from '@shared/types/MessageDTO';
import { useBootstrapStore } from '@/store/useBootstrapStore';
import { useChatStore } from '@/store/useChatStore';
import { useMessageNotificationStore } from '@/store/useMessageNotificationStore';
import { mergeMessageNotifications, setMessageNotificationsInStore } from '@/utils/messages/MessageNotificationFunctions';
import { useUserCacheStore } from '@/store/useUserCacheStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useE2EE } from '@/components/ende-til-ende/useE2EE';
import { useAttachmentDecryption } from '@/features/cryptoAttachments/hooks/useAttachmentDecryption';

export const useBootstrapDistributor = () => {
  const { setCriticalData, setSecondaryData } = useBootstrapStore();
  
  // Opprett EncryptedAttachmentService instans
  const { decryptMessage } = useE2EE();
  const { decryptAttachments } = useAttachmentDecryption();
 
  const {
    setConversations,
    setHasLoadedConversations,
    setCachedMessages,
    setUnreadConversationIds,
    setHasLoadedUnreadConversationIds,
    setPendingMessageRequests,
    setHasLoadedPendingRequests,
    setCachedPendingRequests,
  } = useChatStore();

  const {
    setHasLoadedNotifications: setHasLoadedMessageNotifications,
  } = useMessageNotificationStore();

  const {
    setFriendRequests,
    setHasLoadedFriendRequests,
    setNotifications,   
    setHasLoadedNotifications
  } = useNotificationStore();

  const {
    setCurrentUser,
    setSettings,
    cacheUsersFromBootstrap,
    setUsers
  } = useUserCacheStore();

  const markCacheAsLoaded = useCallback(() => {
    console.log("📋 Marking cached data as loaded (from cache)...");
    
    setHasLoadedConversations(true);
    setHasLoadedUnreadConversationIds(true);
    setHasLoadedPendingRequests(true);
    setHasLoadedMessageNotifications(true);
    setHasLoadedFriendRequests(true);
    setHasLoadedNotifications(true);
    
    console.log("✅ All loading flags set to true (cache mode)");
  }, [
    setHasLoadedConversations,
    setHasLoadedUnreadConversationIds,
    setHasLoadedPendingRequests,
    setHasLoadedMessageNotifications,
    setHasLoadedFriendRequests,
    setHasLoadedNotifications
  ]);

  const distributeCriticalData = useCallback(async (data: CriticalBootstrapResponseDTO) => {
    console.log("📦 Distributing critical bootstrap data (no messages yet)...");
  
    // 1. SyncToken til BootstrapStore
    setCriticalData(data);
  
    // 2. KRITISK: Sett current user FØRST i UserCacheStore
    console.log("👤 Setting current user:", data.user.fullName);
    setCurrentUser(data.user);

    // 3. Settings til UserCacheStore (flyttet fra secondary)
    console.log("⚙️ Setting user settings from critical bootstrap");
    setSettings(data.settings);

    console.log("✅ Critical data distributed:", {
      user: data.user.fullName,
      settings: data.settings.language || 'default',
      syncToken: !!data.syncToken,
      stores: "BootstrapStore (syncToken) + UserCacheStore (currentUser + settings)"
    });
  }, [
    setCriticalData,
    setCurrentUser,
    setSettings
  ]);

  const distributeSecondaryData = useCallback(async (data: SecondaryBootstrapResponseDTO) => {
    console.log("📦 Distributing secondary bootstrap data with E2EE decryption...");
    
    // 1. Bootstrap timestamps til BootstrapStore
    setSecondaryData(data);

    // 2. Conversations til ChatStore
    setConversations(data.recentConversations);
    setHasLoadedConversations(true);

    // 3. DEKRYPTERING: Håndter alle E2EE scenarioer
    if (data.conversationMessages) {
      console.log("🔐 Starting message decryption...");
      
      const e2eeState = useBootstrapStore.getState();
      
      if (!e2eeState.e2eeInitialized) {
        console.error("🔐❌ E2EE not initialized by AuthService");
        
        for (const [conversationId, encryptedMessages] of Object.entries(data.conversationMessages)) {
          const convId = Number(conversationId);
          const errorMessages: MessageDTO[] = encryptedMessages.map(encMsg => ({
            id: encMsg.id,
            senderId: encMsg.senderId,
            text: '🔐 E2EE not initialized - restart app',
            sentAt: encMsg.sentAt,
            conversationId: encMsg.conversationId,
            attachments: [],
            reactions: encMsg.reactions,
            parentMessageId: encMsg.parentMessageId,
            parentMessageText: encMsg.parentMessagePreview,
            parentSender: encMsg.parentSender,
            sender: encMsg.sender,
            isRejectedRequest: encMsg.isRejectedRequest,
            isNowApproved: encMsg.isNowApproved,
            isSilent: encMsg.isSilent,
            isSystemMessage: encMsg.isSystemMessage,
            isDeleted: encMsg.isDeleted
          }));
          setCachedMessages(convId, errorMessages);
        }
        
      } else if (e2eeState.e2eeError === 'needs_setup') {
        console.log("🔐⚠️ User needs E2EE setup - showing placeholder messages");
        
        for (const [conversationId, encryptedMessages] of Object.entries(data.conversationMessages)) {
          const convId = Number(conversationId);
          const setupMessages: MessageDTO[] = encryptedMessages.map(encMsg => ({
            id: encMsg.id,
            senderId: encMsg.senderId,
            text: '🔐 Set up E2EE to read this message',
            sentAt: encMsg.sentAt,
            conversationId: encMsg.conversationId,
            attachments: [],
            reactions: encMsg.reactions,
            parentMessageId: encMsg.parentMessageId,
            parentMessageText: encMsg.parentMessagePreview,
            parentSender: encMsg.parentSender,
            sender: encMsg.sender,
            isRejectedRequest: encMsg.isRejectedRequest,
            isNowApproved: encMsg.isNowApproved,
            isSilent: encMsg.isSilent,
            isSystemMessage: encMsg.isSystemMessage,
            isDeleted: encMsg.isDeleted
          }));
          setCachedMessages(convId, setupMessages);
        }
        
      } else if (e2eeState.e2eeError === 'needs_restore') {
        console.log("🔐⚠️ User needs E2EE restore - showing placeholder messages");
        
        for (const [conversationId, encryptedMessages] of Object.entries(data.conversationMessages)) {
          const convId = Number(conversationId);
          const restoreMessages: MessageDTO[] = encryptedMessages.map(encMsg => ({
            id: encMsg.id,
            senderId: encMsg.senderId,
            text: '🔐 Restore backup phrase to read this message',
            sentAt: encMsg.sentAt,
            conversationId: encMsg.conversationId,
            attachments: [],
            reactions: encMsg.reactions,
            parentMessageId: encMsg.parentMessageId,
            parentMessageText: encMsg.parentMessagePreview,
            parentSender: encMsg.parentSender,
            sender: encMsg.sender,
            isRejectedRequest: encMsg.isRejectedRequest,
            isNowApproved: encMsg.isNowApproved,
            isSilent: encMsg.isSilent,
            isSystemMessage: encMsg.isSystemMessage,
            isDeleted: encMsg.isDeleted
          }));
          setCachedMessages(convId, restoreMessages);
        }
        
      } else if (e2eeState.e2eeHasKeyPair) {
        // E2EE er klar - dekrypter meldinger og attachments
        
        // Debug nøkkel-debugging før dekryptering
        if (__DEV__) {
          console.log('🔐🐛 === BOOTSTRAP E2EE DEBUG ===');
          const currentUser = useUserCacheStore.getState().currentUser;
          const crypto = (await import('@/components/ende-til-ende/CryptoService')).CryptoService.getInstance();
          
          if (currentUser?.id) {
            const privateKey = await crypto.getPrivateKey(currentUser.id);
            console.log('🔐🐛 Bootstrap user key info:', {
              userId: currentUser.id,
              hasPrivateKey: !!privateKey,
              privateKeyLength: privateKey?.length,
              keyPreview: privateKey?.substring(0, 20) + '...'
            });
            
            if (privateKey) {
              try {
                await (crypto as any).debugKeyConsistency(currentUser.id);
              } catch (error) {
                console.error('🔐🐛 Key consistency debug failed:', error);
              }
            }
            
            const firstConversation = Object.entries(data.conversationMessages)[0];
            if (firstConversation && firstConversation[1].length > 0) {
              const [convId, messages] = firstConversation;
              const firstMessage = messages[0];
              
              console.log('🔐🐛 Testing first message:', {
                conversationId: convId,
                messageId: firstMessage.id,
                hasKeyInfo: !!firstMessage.keyInfo,
                keyInfoKeys: Object.keys(firstMessage.keyInfo || {}),
                hasDataForUser: !!firstMessage.keyInfo?.[currentUser.id.toString()],
                encryptedDataLength: firstMessage.keyInfo?.[currentUser.id.toString()]?.length
              });
            }
          }
          console.log('🔐🐛 === DEBUG COMPLETED ===');
        }
        
        for (const [conversationId, encryptedMessages] of Object.entries(data.conversationMessages)) {
          const convId = Number(conversationId);
          
          if (encryptedMessages && encryptedMessages.length > 0) {
            console.log(`🔐⚡ Starting parallel decryption of ${encryptedMessages.length} messages for conversation ${convId}...`);
            
            // PARALLELL DEKRYPTERING - alle meldinger dekrypteres samtidig
            const decryptionPromises = encryptedMessages.map(async (encryptedMsg, index) => {
              try {
                const currentUser = useUserCacheStore.getState().currentUser;
                if (!currentUser) {
                  throw new Error('Current user not set');
                }

                // Debug dekrypteringsoperasjon i development
                if (__DEV__ && index < 3) {
                  console.log(`🔐🐛 Decrypting message ${index}:`, {
                    messageId: encryptedMsg.id,
                    userId: currentUser.id,
                    hasKeyInfo: !!encryptedMsg.keyInfo,
                    hasUserData: !!encryptedMsg.keyInfo?.[currentUser.id.toString()],
                    encryptedTextEmpty: !encryptedMsg.encryptedText || encryptedMsg.encryptedText === "",
                    version: encryptedMsg.version || 1
                  });
                }

                const decrypted = await decryptMessage(encryptedMsg, currentUser.id);
                
                if (decrypted) {
                  // ATTACHMENT DEKRYPTERING: Dekrypter alle attachments og erstatt fileUrl
                  const processedAttachments = await decryptAttachments(
                    encryptedMsg.encryptedAttachments || [],
                    currentUser.id
                  );

                  // Konverter DecryptedMessageDTO til MessageDTO format med prosesserte attachments
                  const messageDto: MessageDTO = {
                    id: decrypted.id,
                    senderId: decrypted.senderId,
                    text: decrypted.text,
                    sentAt: decrypted.sentAt,
                    conversationId: decrypted.conversationId,
                    attachments: processedAttachments,
                    reactions: decrypted.reactions,
                    parentMessageId: decrypted.parentMessageId,
                    parentMessageText: decrypted.parentMessageText,
                    parentSender: decrypted.parentSender,
                    sender: decrypted.sender,
                    isRejectedRequest: decrypted.isRejectedRequest,
                    isNowApproved: decrypted.isNowApproved,
                    isSilent: decrypted.isSilent,
                    isSystemMessage: decrypted.isSystemMessage,
                    isDeleted: decrypted.isDeleted
                  };
                  
                  // Debug suksessful dekryptering
                  if (__DEV__ && index < 3) {
                    console.log(`🔐🐛 Decryption SUCCESS for message ${index}:`, {
                      messageId: decrypted.id,
                      textLength: decrypted.text?.length || 0,
                      textPreview: decrypted.text?.substring(0, 30) || 'null',
                      attachmentCount: messageDto.attachments.length,
                      decryptedAttachments: messageDto.attachments.filter(att => att.isEncrypted && att.fileUrl.startsWith('blob:')).length
                    });
                  }
                  
                  return { success: true, message: messageDto, index };
                } else {
                  throw new Error('Decryption returned null');
                }
              } catch (error) {
                console.error(`🔐❌ Failed to decrypt message ${index} in conversation ${convId}:`, error);
                
                // Debug detaljert feil
                if (__DEV__) {
                  console.log(`🔐🐛 Decryption FAILED for message ${index}:`, {
                    messageId: encryptedMsg.id,
                    error: error instanceof Error ? error.message : String(error),
                    hasKeyInfo: !!encryptedMsg.keyInfo,
                    keyInfoKeys: Object.keys(encryptedMsg.keyInfo || {}),
                    encryptedTextLength: encryptedMsg.encryptedText?.length || 0
                  });
                }
                
                // Returner failed message
                const failedMessage: MessageDTO = {
                  id: encryptedMsg.id,
                  senderId: encryptedMsg.senderId,
                  text: '🔐 Failed to decrypt message',
                  sentAt: encryptedMsg.sentAt,
                  conversationId: encryptedMsg.conversationId,
                  attachments: [],
                  reactions: encryptedMsg.reactions,
                  parentMessageId: encryptedMsg.parentMessageId,
                  parentMessageText: encryptedMsg.parentMessagePreview,
                  parentSender: encryptedMsg.parentSender,
                  sender: encryptedMsg.sender,
                  isRejectedRequest: encryptedMsg.isRejectedRequest,
                  isNowApproved: encryptedMsg.isNowApproved,
                  isSilent: encryptedMsg.isSilent,
                  isSystemMessage: encryptedMsg.isSystemMessage,
                  isDeleted: encryptedMsg.isDeleted
                };
                
                return { success: false, message: failedMessage, index, error };
              }
            });
            
            // Prosesser resultater og behold original rekkefølge
            const results = await Promise.allSettled(decryptionPromises);
            const decryptedMessages: MessageDTO[] = [];
            let successCount = 0;
            let failureCount = 0;
            let attachmentCount = 0;
            
            results.forEach((result, index) => {
              if (result.status === 'fulfilled') {
                decryptedMessages.push(result.value.message);
                if (result.value.success) {
                  successCount++;
                  // Tell dekrypterte attachments
                  const decryptedAttachments = result.value.message.attachments?.filter(att => att.isEncrypted && att.fileUrl.startsWith('blob:'))?.length || 0;
                  attachmentCount += decryptedAttachments;
                } else {
                  failureCount++;
                }
              } else {
                console.error(`🔐💥 Promise rejection for message ${index}:`, result.reason);
                failureCount++;
                
                // Legg til generisk feilmelding
                const fallbackMessage: MessageDTO = {
                  id: encryptedMessages[index]?.id || -1,
                  senderId: encryptedMessages[index]?.senderId || null,
                  text: '🔐 Critical decryption failure',
                  sentAt: encryptedMessages[index]?.sentAt || new Date().toISOString(),
                  conversationId: convId,
                  attachments: [],
                  reactions: [],
                  isSystemMessage: false,
                  isDeleted: false
                };
                
                decryptedMessages.push(fallbackMessage);
              }
            });
            
            // Cache de dekrypterte meldingene
            setCachedMessages(convId, decryptedMessages);
            console.log(`🔐✅ Parallel decryption completed for conversation ${convId}: ${successCount} successful, ${failureCount} failed, ${decryptedMessages.length} total, ${attachmentCount} attachments decrypted`);
          }
        }
        
        console.log(`🔐✅ Message and attachment decryption completed for ${Object.keys(data.conversationMessages).length} conversations`);
      }
    }

    // 4. Chat-relatert data direkte til ChatStore
    setUnreadConversationIds(data.unreadConversationIds);
    setHasLoadedUnreadConversationIds(true);
   
    // 5. Pending message requests til ChatStore
    setPendingMessageRequests(data.pendingMessageRequests);
    setHasLoadedPendingRequests(true);
    setCachedPendingRequests(data.pendingMessageRequests);

    // 6. MessageNotifications til MessageNotificationStore
    if (data.recentMessageNotifications && data.recentMessageNotifications.length > 0) {
      const merged = mergeMessageNotifications(data.recentMessageNotifications);
      setMessageNotificationsInStore(merged, "bootstrap");
    } else {
      setHasLoadedMessageNotifications(true);
      console.log("📨 Ingen message notifications mottatt, men marker som loaded");
    }

    // 7. Friend invitations til NotificationStore
    if (data.pendingFriendInvitations && data.pendingFriendInvitations.length > 0) {
      setFriendRequests(data.pendingFriendInvitations);
      setHasLoadedFriendRequests(true);

      const { setFriendRequestTotalCount } = useNotificationStore.getState();
      setFriendRequestTotalCount(data.pendingFriendInvitations.length);
    } else {
      setHasLoadedFriendRequests(true);
    }

    // 8. App notifications til NotificationStore
    if (data.recentNotifications && data.recentNotifications.length > 0) {
      setNotifications(data.recentNotifications);
      setHasLoadedNotifications(true);
    } else {
      setHasLoadedNotifications(true);
    }

    // 9. Cache all users med relationships i UserCache
    if (data.allUserSummaries && data.allUserSummaries.length > 0) {
      setUsers(data.allUserSummaries);
    }

    // 10. Cache all other users from bootstrap data (unified method)
    cacheUsersFromBootstrap(data);  // Only secondary data

    console.log("✅ Secondary data distributed:", {
      conversations: data.recentConversations.length,
      conversationMessages: Object.keys(data.conversationMessages || {}).length,
      totalMessages: Object.values(data.conversationMessages || {}).reduce((sum, msgs) => sum + msgs.length, 0),
      unreadConversations: data.unreadConversationIds.length,
      pendingRequests: data.pendingMessageRequests.length,
      messageNotifications: data.recentMessageNotifications?.length || 0,
      pendingFriendInvitations: data.pendingFriendInvitations.length,
      appNotifications: data.recentNotifications?.length || 0,
      allUserSummaries: data.allUserSummaries?.length || 0,
      stores: "BootstrapStore + ChatStore + MessageNotificationStore + NotificationStore + UserCache",
      encryption: "Messages and attachments decrypted in secondary bootstrap"
    });
  }, [
    setSecondaryData,
    setConversations,
    setHasLoadedConversations,
    setCachedMessages,
    setUnreadConversationIds,
    setHasLoadedUnreadConversationIds,
    setPendingMessageRequests,
    setHasLoadedPendingRequests,
    setCachedPendingRequests,
    setHasLoadedMessageNotifications,
    setFriendRequests,
    setHasLoadedFriendRequests,
    setNotifications,           
    setHasLoadedNotifications,
    setUsers,
    decryptMessage,
    cacheUsersFromBootstrap,
  ]);

  return {
    distributeCriticalData,
    distributeSecondaryData,
    markCacheAsLoaded,
  };
};