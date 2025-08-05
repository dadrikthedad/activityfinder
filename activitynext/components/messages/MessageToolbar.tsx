import { Paperclip, Smile, ArrowDown } from "lucide-react";
import MessageSettingsDropdown from "./MessageSettingsDropdown";
import TooltipButton from "../common/TooltipButton";
import { useState } from "react";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";


interface MessageToolbarProps {
  atBottom?: boolean;
  onScrollToBottom?: () => void;
  onPickFile?: () => void; // Kombinert funksjon for alle filer
  onPickEmoji?: () => void;
  showScrollToBottom?: boolean;
  showFile?: boolean;
  showEmoji?: boolean;
  showSettings?: boolean;
  onShowUserPopover?: (
    user: UserSummaryDTO,
    pos: { x: number; y: number },
    groupData?: {
      isGroup: boolean;
      participants: UserSummaryDTO[];
      onLeaveGroup?: () => void;
      isPendingRequest?: boolean;
      conversationId?: number;
    }
  ) => void;
  userPopoverRef?: React.RefObject<HTMLDivElement | null>;
}

export default function MessageToolbar({
  atBottom,
  onScrollToBottom,
  onPickFile,
  onPickEmoji,
  showScrollToBottom = true,
  showFile = true,
  showEmoji = true,
  showSettings = true,
  onShowUserPopover,
}: MessageToolbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex items-center justify-between mb-1">
      {/* Scroll-knapp og menyknapp til venstre */}
      <div className="flex items-center gap-5">
        {showSettings && (
          <MessageSettingsDropdown
            open={settingsOpen}
            setOpen={setSettingsOpen}
            onShowUserPopover={onShowUserPopover}
            useOverlaySystem={true}
          />
        )}
       
        {showScrollToBottom && !atBottom && onScrollToBottom && (
          <TooltipButton
            icon={<ArrowDown size={18} />}
            tooltip="Scroll til bunnen"
            onClick={onScrollToBottom}
          />
        )}
      </div>

      {/* Fil/emoji-knapper til høyre */}
      <div className="flex items-center gap-2">
        {showFile && onPickFile && (
          <TooltipButton
            icon={<Paperclip size={18} />}
            tooltip="Add files (images, videos, documents)"
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