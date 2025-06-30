// Håndterer sletting av sin modal som kommer opp ved å trykke på Remove Friend
import { useConfirmDialog } from "@/hooks/useConfirmDialog"; 
import { useRemoveFriend } from "@/hooks/useRemoveFriend";

export function useConfirmRemoveFriend() {
  const { confirm, ConfirmDialog } = useConfirmDialog(); // ✅ Add ConfirmDialog
  const { handleRemoveFriend } = useRemoveFriend();

  const confirmAndRemove = async (
    friendId: number,
    friendName: string,
    onSuccess?: () => void
  ) => {
    const confirmed = await confirm({
      title: "Confirm Remove Friend",
      message: (
        <span>
          Are you sure you want to remove{" "}
          <span className="font-semibold italic text-base md:text-lg">
            {friendName}
          </span>{" "}
          as a friend?
        </span>
      ),
    });
    
    if (confirmed) {
      await handleRemoveFriend(friendId, onSuccess);
    }
  };
  
  return { confirmAndRemove, ConfirmDialog }; // ✅ Return ConfirmDialog
}
