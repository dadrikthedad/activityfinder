// Her er vennelisten samt alle venneforespørslene
import FriendList from "@/components/friends/FriendList";
import FriendInvitations from "@/components/friends/FriendInvitations";

export default function FriendsPage() {
  return (
    <div className="flex flex-col items-center justify-start min-h-screen px-6 py-12 text-center bg-white dark:bg-black">

      <section className="w-full max-w-5xl">
        <FriendInvitations />
      </section>

      <section className="w-full max-w-5xl mt-12">
        <h2 className="text-xl font-semibold mb-4 text-[#1C6B1C]">Your friends</h2>
        <FriendList />
      </section>
    </div>
  );
}