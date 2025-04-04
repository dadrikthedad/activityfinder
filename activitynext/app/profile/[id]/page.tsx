import { getUserProfile } from "@/services/profile";
import ProfileInfoCard from "@/components/ProfileInfoCard";
import ProfileAvatar from "@/components/ProfileAvatar";

interface Props {
  params: { id: string };
}

export default async function PublicProfilePage({ params }: Props) {
  const userId = Number(params.id);
  const data = await getUserProfile(userId);

  const user = data.user; // hvis backend sender med brukerinfo separat
  const profile = data;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-center">User Profile</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-2 space-y-4">
          <ProfileInfoCard
            user={user}
            profile={profile}
            showEmail={false}
            isEditable={false}
          />
        </div>

        <div className="flex flex-col items-center md:justify-end mt-12 md:mt-20 space-y-6">
          <ProfileAvatar imageUrl={profile.profileImageUrl} isEditable={false} />
        </div>
      </div>
    </div>
  );
}
