import ProfileNavButton from "../settings/ProfileNavButton";
import { ImageIcon, Paperclip, Smile, ArrowDown } from "lucide-react";
import MessageSettingsDropdown from "./MessageSettingsDropdown";

interface MessageToolbarProps {
  atBottom: boolean;
  onScrollToBottom: () => void;
  onPickImage?: () => void;
  onPickFile?: () => void;
  onPickEmoji?: () => void;
}

export default function MessageToolbar({
  atBottom,
  onScrollToBottom,
  onPickImage,
  onPickFile,
  onPickEmoji,
}: MessageToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-1">
      {/* Scroll-knapp til venstre */}
      <div className="flex items-center gap-5">
        <MessageSettingsDropdown />
        {!atBottom && (
          <ProfileNavButton
            text={<ArrowDown size={18} />}
            variant="tiny"
            onClick={onScrollToBottom}
            className="hover:bg-[#0F3D0F]"
          />
        )}
      </div>

      {/* Emoji/fil/bilde-knapper til høyre */}
      <div className="flex items-center gap-2">
        <ProfileNavButton text={<ImageIcon size={18} />} variant="tiny" onClick={onPickImage} />
        <ProfileNavButton text={<Paperclip size={18} />} variant="tiny" onClick={onPickFile} />
        <ProfileNavButton text={<Smile size={18} />} variant="tiny" onClick={onPickEmoji} />
      </div>
    </div>
  );
}
