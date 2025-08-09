// Håndterer sletting av sin modal som kommer opp ved å trykke på Remove Friend
import { useConfirmModalNative } from "@/hooks/useConfirmModalNative"; 
import { useRemoveFriend } from "@/hooks/useRemoveFriend";
import { Text, View } from 'react-native';

export function useConfirmRemoveFriend() {
  const { confirm } = useConfirmModalNative(); // Ingen ConfirmDialog å returnere!
  const { handleRemoveFriend } = useRemoveFriend();

  const confirmAndRemove = async (
    friendId: number,
    friendName: string,
    onSuccess?: () => void
  ) => {
    const confirmed = await confirm({
      title: "Confirm Remove Friend",
      message: (
        <View>
          <Text style={{ textAlign: 'center', fontSize: 16, color: '#374151' }}>
            Are you sure you want to remove{" "}
            <Text style={{ fontWeight: '600', fontStyle: 'italic' }}>
              {friendName}
            </Text>{" "}
            as a friend?
          </Text>
        </View>
      ),
    });
   
    if (confirmed) {
      await handleRemoveFriend(friendId, onSuccess);
    }
  };
 
  return { confirmAndRemove }; // Kun confirmAndRemove - ingen component!
}