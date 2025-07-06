// components/messages/ReplyPreview.tsx
import { MessageDTO } from "@/types/MessageDTO";

interface ReplyPreviewProps {
  message: MessageDTO;
  onClear: () => void;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({ message, onClear }) => {
  return (
    <div className="bg-gray-100 dark:bg-[#2E2E2E] border-1 border-[#1C6B1C] p-3 mb-2 rounded">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#1C6B1C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Replying to {message.sender?.fullName}
          </span>
        </div>
        <button
          onClick={onClear}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-lg leading-none"
          title="Cancel reply"
        >
          ×
        </button>
      </div>
      
      {/* Preview of original message */}
      <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
        {message.text || (message.attachments?.length ? `${message.attachments.length} attachment(s)` : "Message")}
      </div>
      
      {/* Show first attachment if text is short */}
      {message.attachments && message.attachments.length > 0 && (!message.text || message.text.length < 50) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <span>📎</span>
          <span>{message.attachments[0].fileName || 'File'}</span>
          {message.attachments.length > 1 && <span>+{message.attachments.length - 1} more</span>}
        </div>
      )}
    </div>
  );
};