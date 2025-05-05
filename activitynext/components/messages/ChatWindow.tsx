"use client";
// Her er ChatWindow.tsx som viser både samtaleliste og meldingsliste til ChatPage og ChatDropdown. Henter chat-oppsett fra useChatState
import { useEffect } from "react";
import MessageList from "@/components/messages/MessageList";
import MessageInput from "@/components/messages/MessageInput";
import ConversationList from "@/components/messages/ConversationList";
import { useChatContext } from "@/context/ChatContext";
import { useChatState } from "@/hooks/conversations/useChatState";



interface ChatWindowProps extends ReturnType<typeof useChatState> {
    showSidebar?: boolean;
    onModeChange?: (mode: "chat" | "list") => void;
  }

  export default function ChatWindow({ showSidebar = true, onModeChange }: ChatWindowProps) {
    const {
      conversations,
      user,
      userLoading,
      selectedConversationId,
      setSelectedConversationId,
      messages,
      messagesError,
      newMessage,
      setNewMessage,
      handleSend,
      sendingMessage,
      inputRef,
    } = useChatContext();

    useEffect(() => {
        if (onModeChange) {
          onModeChange(selectedConversationId ? "chat" : "list");
        }
      }, [selectedConversationId, onModeChange]);
  
    if (showSidebar) {
        return (
          <div className="flex justify-center w-full px-4 py-6 ">
            <div className="flex gap-20 w-full max-w-6xl">
              {/* Samtaler */}
              <div className="w-[300px] flex-shrink-0 -ml-30">
                <ConversationList
                  conversations={conversations}
                  currentUserId={user?.id}
                  selectedConversationId={selectedConversationId}
                  onSelect={setSelectedConversationId}
                />
              </div>
    
              {/* Meldinger */}
              <div className="flex flex-col flex-1 min-w-0 space-y-4">
                {messagesError && (
                  <p className="text-red-500">Error: {messagesError}</p>
                )}
    
                <MessageList
                  messages={messages}
                  currentUserId={user?.id}
                  userAvatar={user?.profileImageUrl}
                />
    
                {selectedConversationId && (
                  <MessageInput
                    value={newMessage}
                    onChange={setNewMessage}
                    onSend={handleSend}
                    loading={sendingMessage}
                    disabled={userLoading || !user}
                    inputRef={inputRef}
                  />
                )}
              </div>
            </div>
          </div>
        );
      }
    
      // 📱 Mobil/drawer-modus (ChatDropdown)
      return (
        <div
  className="relative h-[60vh] w-full flex overflow-visible"
  style={{ width: selectedConversationId ? "100%" : "400px" }} // 💡
>
          {/* VENSTRE: Samtaler */}
          <div
            className={`
                relative z-10 w-[400px] flex-shrink-0 p-4 dark:border-gray-700 bg-white dark:bg-[#1e2122]
                transition-transform duration-300 ease-in-out 
                ${selectedConversationId ? "-translate-x" : "translate-x-0"}
            `}
            >
            <ConversationList
              conversations={conversations}
              currentUserId={user?.id}
              selectedConversationId={selectedConversationId}
              onSelect={setSelectedConversationId}
              useMiniAvatarOnly
            />
          </div>
    
          {/* HØYRE: Meldinger */}
          {selectedConversationId && (
            <div
            className={`
              absolute top-0 right-0 h-full bg-white dark:bg-[#1e2122] p-4 z-20 shadow-lg ring-1 ring-black/10
              transition-transform duration-300 ease-in-out flex flex-col
              border-l border-[#1C6B1C]
            `}
            style={{ width: "calc(100% - 80px)" }}
          >
            {/* Meldingsliste som fyller plassen */}
            <div className="flex-1 overflow-y-auto space-y-4 border border-[#1C6B1C] rounded-lg">
              {messagesError && <p className="text-red-500">Error: {messagesError}</p>}
          
              <MessageList
                messages={messages}
                currentUserId={user?.id}
                userAvatar={user?.profileImageUrl}
                isCompact={!showSidebar}
              />
            </div>
          
            {/* MessageInput + tilbakeknapp under */}
            <div className="overflow-y-auto">
              <MessageInput
                value={newMessage}
                onChange={setNewMessage}
                onSend={handleSend}
                loading={sendingMessage}
                disabled={userLoading || !user}
                inputRef={inputRef}
                isMobile
                onBack={() => setSelectedConversationId(null)}
              />
              
            </div>
          </div>
            )}
        </div>
      );
    }