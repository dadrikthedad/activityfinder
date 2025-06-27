// Oppdatert PublicProfileView.tsx med NewMessageWindow og overlay system
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/services/profile";
import ProfileInfoCard from "@/components/ProfileInfoCard";
import ProfileAvatar from "@/components/ProfileAvatar";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import ProfileActionMenu from "@/components/profile/ProfileActionMenu";
import { PublicProfileDTO } from "@/types/PublicProfileDTO";
import SimpleFriendList from "@/components/friends/SimpleFriendList";
import { useFriendWith } from "@/hooks/useFriendWith";
import Spinner from "../common/Spinner";
import { useSendFriendInvitation } from "@/hooks/useSendFriendInvitation";
import { useConfirmRemoveFriend } from "@/hooks/useConfirmRemoveFriend";
import PublicSimpleFriendList from "@/components/friends/PublicSimpleFriendList";
import { mutate } from "swr";
// ✅ ENDRE: Bytt ut modal import med overlay og NewMessageWindow
import { useOverlay } from "@/context/OverlayProvider";
import NewMessageWindow from "../messages/NewMessageWindow";
import { MessageDTO } from "@/types/MessageDTO";
import { SendGroupRequestsResponseDTO } from "@/types/SendGroupRequestsDTO";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";

export default function PublicProfileView({
  profile: initialProfile,
  isEditable = false,
  isOwner = false,
}: {
  profile: PublicProfileDTO;
  isEditable?: boolean;
  isOwner?: boolean;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [reloadCounter ] = useState(0);
  const { token } = useAuth();
  const { isFriend, loading: friendshipLoading } = useFriendWith(profile.userId);
  const { sendInvitation, sending, error } = useSendFriendInvitation();
  const { confirmAndRemove } = useConfirmRemoveFriend();
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const { userId } = useAuth()
  const isActuallyOwner = isOwner || (userId === profile.userId);

  // ✅ NYTT: Overlay system for New Message Window
  const newMessageOverlay = useOverlay();
  const [showNewMessageWindow, setShowNewMessageWindow] = useState(false);
  const [newMessageReceiver, setNewMessageReceiver] = useState<UserSummaryDTO | undefined>();

  const imageUrl =
    profile.profileImageUrl?.trim() !== ""
      ? profile.profileImageUrl
      : "/default-avatar.png";

  // ✅ NYTT: Handle new message window
  const handleShowNewMessage = () => {
    const receiver: UserSummaryDTO = {
      id: profile.userId,
      fullName: profile.fullName ?? "",
      profileImageUrl: profile.profileImageUrl ?? "/default-avatar.png"
    };
    
    console.log('📝 Opening new message window for:', receiver.fullName);
    setNewMessageReceiver(receiver);
    setShowNewMessageWindow(true);
    newMessageOverlay.open();
  };

  const handleCloseNewMessage = useCallback(() => {
    console.log('📝 Closing new message window');
    setShowNewMessageWindow(false);
    setNewMessageReceiver(undefined);
    newMessageOverlay.close();
  }, [newMessageOverlay]);

  const handleMessageSent = (message: MessageDTO) => {
    console.log("📤 Message sent from profile:", message);
    handleCloseNewMessage();
  };

  const handleGroupCreated = (response: SendGroupRequestsResponseDTO) => {
    console.log("👥 Group created from profile:", response);
    handleCloseNewMessage();
  };

  // ✅ NYTT: Sync new message window state
  useEffect(() => {
    if (!newMessageOverlay.isOpen && showNewMessageWindow) {
      console.log('📝 New message overlay closed externally, cleaning up state');
      setShowNewMessageWindow(false);
      setNewMessageReceiver(undefined);
    }
  }, [newMessageOverlay.isOpen, showNewMessageWindow]);

  const refetchProfile = useCallback(async () => {
    if (!initialProfile?.userId || !token) return;
    try {
      const updated = await getUserProfile(initialProfile.userId, token);
      setProfile(updated);
    } catch (error) {
      console.error("❌ Failed to refetch profile", error);
    }
  }, [initialProfile?.userId, token]);

  const handleRemove = async () => {
    await confirmAndRemove(profile.userId, profile.fullName ?? "this user", async () => {
      await refetchProfile();
      mutate([`/friends/is-friend-with`, profile.userId]);
    });
  };

  const handleSendInvitation = async () => {
    if (friendRequestSent) return;
    await sendInvitation(profile.userId);
    setFriendRequestSent(true);
  };

  useEffect(() => {
    if (isEditable) {
      refetchProfile();
    }
  }, [reloadCounter, isEditable, refetchProfile]);

  return (
    <>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#145214]">
          {isActuallyOwner ? "Your Profile" : "User Profile"}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          <div className="md:col-span-2 space-y-4">
            <ProfileInfoCard
              profile={profile}
              showEmail={profile.showEmail}
              isEditable={isEditable}
              refetchProfile={refetchProfile}
            />
          </div>

          <div className="flex flex-col items-center md:justify-end mt-12 md:mt-20 space-y-6">
            {friendshipLoading ? (
              <div className="flex justify-end items-center h-[250px] w-full">
                <Spinner text="Loading profile" />
              </div>
            ) : (
              <>
                <ProfileAvatar
                  imageUrl={imageUrl ?? "/default-avatar.png"}
                  isEditable={isEditable}
                  refetchProfile={refetchProfile}
                />

                {isActuallyOwner ? (
                  isEditable ? (
                    <>
                      <ProfileNavButton
                        href={`/profile/${profile.userId}`}
                        text="Back to Profile"
                        variant="long"
                      />
                      <ProfileNavButton
                        href="/profilesettings"
                        text="Settings"
                        variant="long"
                      />
                    </>
                  ) : (
                    <>
                      <ProfileNavButton
                        href="/editprofile"
                        text="Edit Profile"
                        variant="long"
                      />
                      <ProfileNavButton
                        href="/profilesettings"
                        text="Settings"
                        variant="long"
                      />
                    </>
                  )
                ) : (
                  <>
                    {isFriend ? (
                      <>
                        {/* ✅ ENDRE: Bruk handleShowNewMessage i stedet for modal */}
                        <ProfileNavButton
                          onClick={handleShowNewMessage}
                          text="Send Message"
                          variant="long"
                        />
                        <ProfileNavButton
                          href="#"
                          text="Follow User"
                          variant="long"
                        />
                      </>
                    ) : (
                      <>
                        <ProfileNavButton
                          onClick={handleSendInvitation}
                          text={
                            friendRequestSent ||
                            error === "A friend request is already pending between these users."
                              ? "Friend Request Sent"
                              : sending
                              ? "Sending..."
                              : "Add as Friend"
                          }
                          disabled={
                            sending ||
                            friendRequestSent ||
                            error === "A friend request is already pending between these users."
                          }
                          variant="long"
                        />
                        {/* ✅ ENDRE: Bruk handleShowNewMessage i stedet for modal */}
                        <ProfileNavButton
                          onClick={handleShowNewMessage}
                          text="Send Message"
                          variant="long"
                        />
                        <ProfileNavButton
                          href="#"
                          text="Follow User"
                          variant="long"
                        />
                      </>
                    )}
                    <ProfileActionMenu
                      isFriend={isFriend ?? false}
                      onRemoveFriend={handleRemove}
                    />
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {isActuallyOwner && !isEditable && (
          <div className="w-full">
            <h2 className="text-xl text-center font-semibold text-[#145214]">Your Friends</h2>
            <SimpleFriendList />
          </div>
        )}

        {!isActuallyOwner && !isEditable && (
          <div className="w-full mt-10">
            <h2 className="text-xl text-center font-semibold text-[#145214]">
              Their Friends
            </h2>
            <PublicSimpleFriendList userId={profile.userId} />
          </div>
        )}
      </div>

      {/* ✅ NYTT: New Message Window med overlay system */}
      {newMessageOverlay.isOpen && showNewMessageWindow && (
        <div ref={newMessageOverlay.ref} style={{ zIndex: newMessageOverlay.zIndex }}>
          <NewMessageWindow
            initialReceiver={newMessageReceiver}
            initialPosition={{ x: 400, y: 200 }}
            onClose={handleCloseNewMessage}
            onMessageSent={handleMessageSent}
            onGroupCreated={handleGroupCreated}
          />
        </div>
      )}
    </>
  );
}