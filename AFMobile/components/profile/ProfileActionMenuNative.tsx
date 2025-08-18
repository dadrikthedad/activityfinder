import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import ButtonNative from "../common/buttons/ButtonNative";
import { useConfirmModalNative } from "@/hooks/useConfirmModalNative";

interface Props {
  isFriend: boolean;
  onRemoveFriend?: () => void;
}

export default function ProfileActionMenuNative({ 
  isFriend, 
  onRemoveFriend 
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const { confirm } = useConfirmModalNative();

  const handleRemoveFriend = async () => {
    setShowMenu(false);
    // Small delay to let modal close before showing confirm dialog
    setTimeout(async () => {
      const confirmed = await confirm({
        title: "Remove Friend",
        message: "Are you sure you want to remove this person from your friends list?"
      });
      
      if (confirmed) {
        onRemoveFriend?.();
      }
    }, 100);
  };

  const handleBlockUser = async () => {
    setShowMenu(false);
    setTimeout(async () => {
      const confirmed = await confirm({
        title: "Block User",
        message: "Are you sure you want to block this user? They will no longer be able to contact you."
      });
      
      if (confirmed) {
        console.log("🚫 Block user confirmed");
        // TODO: Implement block functionality
        
        // Show success confirmation
        await confirm({
          title: "Success",
          message: "User has been blocked."
        });
      }
    }, 100);
  };


  const handleReportUser = async () => {
    setShowMenu(false);
    setTimeout(async () => {
      // First confirm they want to report
      const wantToReport = await confirm({
        title: "Report User",
        message: "Do you want to report this user for inappropriate behavior?"
      });
      
      if (wantToReport) {
        // Show reason selection - since we can't easily do multiple options with this modal,
        // we'll ask for the most common reason first
        const isSpam = await confirm({
          title: "Report Reason",
          message: "Is this user sending spam or unwanted messages?"
        });
        
        if (isSpam) {
          submitReport("spam");
        } else {
          const isHarassment = await confirm({
            title: "Report Reason", 
            message: "Is this user harassing or bullying you or others?"
          });
          
          if (isHarassment) {
            submitReport("harassment");
          } else {
            const isInappropriate = await confirm({
              title: "Report Reason",
              message: "Is this user posting inappropriate content?"
            });
            
            if (isInappropriate) {
              submitReport("inappropriate");
            } else {
              submitReport("other");
            }
          }
        }
      }
    }, 100);
  };

  const submitReport = async (reason: string) => {
    console.log(`🚨 Report user for: ${reason}`);
    // TODO: Implement report functionality
    
    // Show success confirmation
    await confirm({
      title: "Report Submitted",
      message: "Thank you for your report. We will review it shortly."
    });
  };

  const closeMenu = () => {
    setShowMenu(false);
  };

  return (
    <>
      {/* Trigger Button */}
      <ButtonNative
        text="More Options"
        onPress={() => setShowMenu(true)}
        variant="primary"
        fullWidth
      />

      {/* Action Sheet Modal */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="slide"
        onRequestClose={closeMenu}
      >
        <View style={styles.modalOverlay}>
          {/* Background Touch Area - Now transparent */}
          <TouchableOpacity 
            style={styles.modalBackground} 
            onPress={closeMenu}
            activeOpacity={1}
          />
          
          {/* Action Sheet Content */}
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.actionSheet}>
              {/* Header */}
              <View style={styles.header}>
                {/* Left spacer for centering */}
                <View style={styles.headerSpacer} />
                
                {/* Centered content */}
                <View style={styles.headerContent}>
                  <Text style={styles.headerTitle}>More Options</Text>
                </View>
                
                {/* Right side with close button */}
                <TouchableOpacity onPress={closeMenu} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtonsContainer}>
                {/* Remove Friend - Only show if they are friends */}
                {isFriend && onRemoveFriend && (
                  <ButtonNative
                    text="Remove Friend"
                    onPress={handleRemoveFriend}
                    variant="danger"
                    fullWidth
                    style={styles.actionButton}
                  />
                )}

                {/* Block User */}
                <ButtonNative
                  text="Block User"
                  onPress={handleBlockUser}
                  variant="danger"
                  fullWidth
                  style={styles.actionButton}
                />

                {/* Report User */}
                <ButtonNative
                  text="Report User"
                  onPress={handleReportUser}
                  variant="danger"
                  fullWidth
                  style={styles.actionButton}
                />
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: 'transparent',
  },
  actionSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    minHeight: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
        borderWidth: 1,
    borderColor: '#1C6B1C'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerSpacer: {
    width: 40,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1C6B1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#ffffffff',
    fontWeight: '600',
  },
  actionButtonsContainer: {
    gap: 12,
  },
  actionButton: {
    marginBottom: 0,
  },
});