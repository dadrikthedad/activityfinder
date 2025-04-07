import { getUserProfile } from "@/services/profile";
import ProfileInfoCard from "@/components/ProfileInfoCard";
import ProfileAvatar from "@/components/ProfileAvatar";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import ProfileActionMenu from "@/components/profile/ProfileActionMenu";
import FormButton from "@/components/FormButton";
import Link from "next/link";
import { use } from "react";

type Params = Promise<{ id: string }>;

export default function PublicProfilePage(props: { params: Params }) {
  const { id } = use(props.params);
  const userId = Number(id);
  const profile = use(getUserProfile(userId)) 
  const isOwner = profile.isOwner;
  const imageUrl =
  profile.profileImageUrl?.trim() !== ""
    ? profile.profileImageUrl
    : "/default-avatar.png";

  const isFriend = false; // TODO: Replace with actual logic if needed og endre det samme med Follow

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-center">
        {isOwner ? "Your Profile" : "User Profile"}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Info */}
        <div className="md:col-span-2 space-y-4">
          <ProfileInfoCard
            profile={profile}
            user={{
              fullName: profile.fullName,
              email: "",
              phone: "",
              dateOfBirth: "",
              country: profile.country ?? "",
              region: profile.region ?? "",
              postalCode: "",
              gender: "Unspecified",
            }}
            showEmail={profile.showEmail}
            isEditable={isOwner}
          />
        </div>

        {/* Sidebar */}
        <div className="flex flex-col items-center md:justify-end mt-12 md:mt-20 space-y-6">
          <ProfileAvatar
            imageUrl={imageUrl}
            isEditable={isOwner}
            refetchProfile={undefined}
          />

          {isOwner ? (
            <>
              <Link href="/editprofile" passHref>
                <FormButton
                  text="Edit Profile"
                  type="button"
                  fullWidth={false}
                  className="text-lg px-16 py-3"
                />
              </Link>
              <Link href="/profilesettings" passHref>
                <FormButton
                  text="Settings"
                  type="button"
                  fullWidth={false}
                  className="text-lg px-16 py-3"
                />
              </Link>
            </>
          ) : (
            <>
              {isFriend ? (
                <>
                  <ProfileNavButton href="#" text="Send Message" variant="long" />
                  <ProfileNavButton href="#" text="Follow User" variant="long" />
                </>
              ) : (
                <>
                  <ProfileNavButton href="#" text="Add as Friend" variant="long" />
                  <ProfileNavButton href="#" text="Send Message" variant="long" />
                  <ProfileNavButton href="#" text="Follow User" variant="long" />
                </>
              )}
              <ProfileActionMenu />
            </>
          )}
        </div>
      </div>
    </div>
  );
}