import { ImageIcon, Paperclip, Smile, ArrowDown } from "lucide-react";
import MessageSettingsDropdown from "./MessageSettingsDropdown";
import TooltipButton from "../common/TooltipButton";
import { useState } from "react";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";

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
  onShowUserPopover: (
    user: UserSummaryDTO,
    pos: { x: number; y: number },
    groupData?: {
      isGroup: boolean;
      participants: UserSummaryDTO[];
      onLeaveGroup?: () => void;
      isPendingRequest?: boolean;
    }
  ) => void;
  onLeaveGroup: (conversationId: number) => Promise<void>;
  userPopoverRef?: React.RefObject<HTMLDivElement | null>;
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
  onShowUserPopover,
  onLeaveGroup,
  userPopoverRef,
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
            onLeaveGroup={onLeaveGroup}
            userPopoverRef={userPopoverRef}
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