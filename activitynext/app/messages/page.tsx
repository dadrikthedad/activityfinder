"use client";

import { useAuth } from "@/context/AuthContext";
import { useCurrentUser } from "@/store/useUserCacheStore";
import { useChatStore } from "@/store/useChatStore";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import ConversationList from "@/components/messages/ConversationList";
import PendingRequestsList from "@/components/messages/PendingMessageList";
import { ChevronUp, ChevronDown } from "lucide-react";

export default function MessagesPage() {
  const { isLoggedIn } = useAuth();
  const currentUser = useCurrentUser();
  const router = useRouter();
  
  // Pending collapse state - from store
  const isPendingCollapsed = useChatStore(state => state.isPendingCollapsed);
  const setIsPendingCollapsed = useChatStore(state => state.setIsPendingCollapsed);
 
  // Chat store state
  const pending = useChatStore(state => state.pendingMessageRequests);
  const hasLoadedPending = useChatStore(state => state.hasLoadedPendingRequests);
 
  const shouldShowPendingSection = !hasLoadedPending || pending.length > 0;

  // Handle conversation selection - navigate to individual conversation
  const handleSelectConversation = useCallback((conversationId: number) => {
    router.push(`/messages/${conversationId}`);
  }, [router]);

  // Toggle pending section
  const togglePending = useCallback(() => {
    setIsPendingCollapsed(!isPendingCollapsed);
  }, [isPendingCollapsed, setIsPendingCollapsed]);

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Logg inn for å se meldinger
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Du må være innlogget för å få tilgang til meldingssystemet.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white px-6 py-2 rounded-md transition"
          >
            Logg inn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1e2122] flex flex-col">
      {/* Pending Requests Section - Collapsible */}
      {shouldShowPendingSection && (
        <div className="flex-shrink-0 bg-white dark:bg-[#1e2122] shadow-sm border-b border-gray-200 dark:border-gray-700">
          {/* Pending Content - with smooth collapse animation */}
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isPendingCollapsed ? 'max-h-0' : 'max-h-96'
          }`}>
            <div className="p-6">
              <PendingRequestsList
                limit={2}
                showMoreLink={true}
                onSelectConversation={handleSelectConversation}
              />
            </div>
          </div>
          
          {/* Drag/Toggle Button */}
          <div className="flex justify-center border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={togglePending}
              className="flex items-center justify-center w-16 h-8 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 group"
              aria-label={isPendingCollapsed ? "Vis ventende forespørsler" : "Skjul ventende forespørsler"}
            >
              {/* Drag handle indicator */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-1 bg-[#1C6B1C] dark:bg-[#1C6B1C] rounded group-hover:bg-[#0F3D0F] dark:group-hover:bg-[#0F3D0F] transition-colors"></div>
                {isPendingCollapsed ? (
                  <ChevronDown size={16} className="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                ) : (
                  <ChevronUp size={16} className="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                )}
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ConversationList - Takes remaining space with proper height calculation */}
      <div className="flex-1 bg-white dark:bg-[#1e2122] relative">
        {/* Fixed height container to ensure proper scrolling */}
        <div 
          className="h-full overflow-hidden"
          style={{ 
            // Calculate height dynamically based on viewport and pending section
            height: shouldShowPendingSection && !isPendingCollapsed 
              ? 'calc(100vh - 200px)' // Adjust based on your pending section height
              : 'calc(100vh - 64px)'   // Adjust based on your navbar height
          }}
        >
          <ConversationList
            selectedId={null}
            onSelect={handleSelectConversation}
            currentUser={currentUser}
          />
        </div>
        
        {/* Floating New Message Button */}
        <button
          onClick={() => router.push('/messages/new')}
          className="fixed bottom-6 right-6 w-14 h-14 bg-[#1C6B1C] hover:bg-[#0F3D0F] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-10 group"
          aria-label="Ny melding"
        >
          <svg 
            className="w-6 h-6 transition-transform group-hover:scale-110" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 4v16m8-8H4" 
            />
          </svg>
        </button>
      </div>
    </div>
  );
}