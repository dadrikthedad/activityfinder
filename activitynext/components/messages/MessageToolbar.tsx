
import { ImageIcon, Paperclip, Smile, ArrowDown } from "lucide-react";
import MessageSettingsDropdown from "./MessageSettingsDropdown";
import TooltipButton from "../common/TooltipButton";

interface MessageToolbarProps {
  atBottom?: boolean;
  onScrollToBottom?: () => void;
  onPickImage?: () => void;
  onPickFile?: () => void;
  onPickEmoji?: () => void;
  showScrollToBottom?: boolean;
  showImage?: boolean;
  showFile?: boolean;
  showEmoji?: boolean;
  showSettings?: boolean;
}

export default function MessageToolbar({
  atBottom,
  onScrollToBottom,
  onPickImage,
  onPickFile,
  onPickEmoji,
  showScrollToBottom = true,
  showImage = true,
  showFile = true,
  showEmoji = true,
  showSettings = true,
}: MessageToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-1">
      {/* Scroll-knapp og menyknapp til venstre */}
      <div className="flex items-center gap-5">
              {showSettings && (
          <div className="relative group">
            <MessageSettingsDropdown />
            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-[#2c2f30] text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none border border-[#1C6B1C] z-50 shadow-lg">
              Settings
            </div>
          </div>
        )}
        
        {showScrollToBottom && !atBottom && onScrollToBottom && (
          <TooltipButton 
            icon={<ArrowDown size={18} />} 
            tooltip="Scroll til bunnen" 
            onClick={onScrollToBottom} 
          />
        )}
      </div>

      {/* Emoji/fil/bilde-knapper til høyre */}
      <div className="flex items-center gap-2">
        {showImage && (
          <TooltipButton
            icon={<ImageIcon size={18} />}
            tooltip="Add picture"
            onClick={onPickImage}
          />
        )}
        {showFile && onPickFile && (
          <TooltipButton
            icon={<Paperclip size={18} />}
            tooltip="Add file"
            onClick={onPickFile}
          />
        )}
        {showEmoji && onPickEmoji && (
          <TooltipButton
            icon={<Smile size={18} />}
            tooltip="Emoji"
            onClick={onPickEmoji}
          />
        )}
      </div>
    </div>
  );
}