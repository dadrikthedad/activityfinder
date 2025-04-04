// components/ProfileInfoCard.tsx
"use client";
import React from "react";
import { useState, useRef } from "react";
import { User } from "@/types/user";
import { Profile } from "@/types/profile";
import FormButton from "@/components/FormButton";
import { useAuth } from "@/context/AuthContext";
import { updateBio, updateWebsites } from "@/services/profile";
import ProfileNavButton from "@/components/settings/ProfileNavButton";
import { PlusCircle } from "lucide-react";

interface Props {
    user: User | null;
    profile: Profile | null;
    showEmail?: boolean;
    isEditable?: boolean;
    refetchProfile?: () => Promise<void>;
  }

  export default function ProfileInfoCard({
    user,
    profile,
    showEmail = true,
    isEditable = false,
    refetchProfile,
  }: Props) {
    const [editingBio, setEditingBio] = useState(false);
    const [bioText, setBioText] = useState(profile?.bio ?? "");
    const [bioSaved, setBioSaved] = useState(false);
    const { token } = useAuth();
    const [editingWebsites, setEditingWebsites] = useState(false);
    const [websiteList, setWebsiteList] = useState<string[]>(profile?.websites || []);
    const [websitesSaved, setWebsitesSaved] = useState(false);
    const lastInputRef = useRef<HTMLInputElement | null>(null);
        
  
    const isEmpty = (value: unknown): boolean => {
        if (value === null || value === undefined) return true;
        if (typeof value === "string" && value.trim() === "") return true;
        if (Array.isArray(value) && value.length === 0) return true;
        return false;
      };
  
      const saveBio = async () => {
        if (!token) return;
        try {
          await updateBio(bioText, token);
          setBioSaved(true);
          setTimeout(() => setBioSaved(false), 2000);
          setEditingBio(false);
    
          if (refetchProfile) {
            await refetchProfile(); // 👈 Henter oppdatert profil etter lagring
          }
        } catch (err) {
          console.error("❌ Failed to update bio:", err);
        }
      }

      const saveWebsites = async () => {
        if (!token) return;
        const cleanedWebsites = websiteList.filter((url) => url.trim() !== "");
        try {
          await updateWebsites(cleanedWebsites, token);
          setWebsitesSaved(true);
          setTimeout(() => setWebsitesSaved(false), 2000);
          setEditingWebsites(false);
          if (refetchProfile) await refetchProfile();
        } catch (err) {
          console.error("❌ Failed to update websites:", err);
        }
      }



  return (
    <div className="bg-white dark:bg-zinc-800 shadow-md rounded-xl p-6 space-y-2 mt-6">
      <h2 className="text-xl font-semibold mb-2">Profile</h2>

      {!isEmpty(user?.fullName) && <p><strong>Name:</strong> {user?.fullName}</p>}
      {showEmail && !isEmpty(user?.email) && <p><strong>Email:</strong> {user?.email}</p>}
      {!isEmpty(user?.dateOfBirth) && (
        <p>
          <strong>Birthday: </strong>
          {new Date(user!.dateOfBirth).toLocaleDateString("no-NO", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      )}
      {!isEmpty(user?.phone) && <p><strong>Phone:</strong> {user?.phone}</p>}
      {!isEmpty(user?.country) && (
        <p>
          <strong>Location:</strong> {user?.country}
          {user?.region && `, ${user.region}`}
        </p>
      )}
      {!isEmpty(user?.postalCode) && <p><strong>Postal Code:</strong> {user?.postalCode}</p>}
      {!isEmpty(user?.gender) && <p><strong>Gender:</strong> {user?.gender}</p>}

      <div className="mt-8" />
      <h2 className="text-xl font-semibold mb-2">Stats</h2>
      {!isEmpty(profile?.totalLikesGiven) && (
        <p><strong>Likes Given:</strong> {profile?.totalLikesGiven}</p>
      )}
      {!isEmpty(profile?.totalLikesRecieved) && (
        <p><strong>Likes Received:</strong> {profile?.totalLikesRecieved}</p>
      )}
      {!isEmpty(profile?.totalCommentsMade) && (
        <p><strong>Comments Made:</strong> {profile?.totalCommentsMade}</p>
      )}
      {!isEmpty(profile?.totalMessagesRecieved) && (
        <p><strong>Messages Received:</strong> {profile?.totalMessagesRecieved}</p>
      )}
      {!isEmpty(profile?.updatedAt) && (
        <p>
          <strong>Last Updated:</strong>{" "}
          {new Date(profile!.updatedAt!).toLocaleString("no-NO", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}

       {/* Bio-felt med inline redigering */}
       <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Bio</h2>
        {isEditable ? (
          editingBio ? (
            <>
              <textarea
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                onInput={(e) => {
                    const target = e.currentTarget;
                    target.style.height = "auto"; // Reset height
                    target.style.height = `${target.scrollHeight}px`; // Set to scroll height
                }}
                maxLength={1000}
                className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-600 resize-none overflow-hidden"
                placeholder="Write your bio here (max 1000 characters)..."
                />
              <div className="flex gap-3 mt-2">
                <FormButton
                  text={bioSaved ? "Saved ✅" : "Save"}
                  type="button"
                  onClick={saveBio}
                  className="px-6 py-2"
                />
                <FormButton
                  text="Cancel"
                  type="button"
                  onClick={() => {
                    setEditingBio(false);
                    setBioText(profile?.bio ?? "");
                  }}
                  className="px-6 py-2 bg-gray-500 hover:bg-gray-600"
                />
              </div>
            </>
          ) : (
            <>
              <p className="whitespace-pre-wrap">{profile?.bio || ""}</p>
              <div className="flex justify-center mt-2">
                <FormButton
                    text="Edit Bio"
                    type="button"
                    onClick={() => setEditingBio(true)}
                    className="text-sm"
                />
                </div>
            </>
          )
        ) : (
          <p className="whitespace-pre-wrap">{profile?.bio || ""}</p>
        )}
      </div>
      <div className="mt-6">
  <h2 className="text-xl font-semibold mb-2">Websites</h2>
  {isEditable ? (
    editingWebsites ? (
      <>
      {websiteList.length === 0 ? (
        <ProfileNavButton
         text="Add website"
         variant="small"
         onClick={() => setWebsiteList([""])}
        />
) : (
  websiteList.map((url, idx) => (
    <div key={idx} className="flex items-center gap-2 w-full">
      <input
        type="text"
        ref={idx === websiteList.length - 1 ? lastInputRef : null}
        className="flex-1 px-4 py-2 rounded-md bg-gray-800 text-white border border-gray-600"
        value={url}
        onChange={(e) => {
          const updated = [...websiteList];
          updated[idx] = e.target.value;
          setWebsiteList(updated);
        }}
        onBlur={(e) => {
          const updated = [...websiteList];
          updated[idx] = e.target.value;
          setWebsiteList(updated);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const updated = [...websiteList];
            updated[idx] = e.currentTarget.value;
            setWebsiteList([...updated, ""]);
            setTimeout(() => {
              lastInputRef.current?.focus();
            }, 10); // 👈 forsinker litt for at feltet skal rendres først
          }
        }}
        placeholder="https://example.com"
      />
      {idx === websiteList.length - 1 && (
        <button
          type="button"
          onClick={() => {
            setWebsiteList([...websiteList, ""]);
            setTimeout(() => {
              lastInputRef.current?.focus();
            }, 10);
          }}
          className="text-green-400 hover:text-green-600 text-sm"
          title="Add new website"
        >
          <PlusCircle size={20} className="text-green-400 hover:text-green-600" />
        </button>
      )}

      
      <button
        type="button"
        onClick={() => {
          const updated = websiteList.filter((_, i) => i !== idx);
          setWebsiteList(updated);
        }}
        tabIndex={-1}
        className="text-red-400 hover:text-red-600 text-sm"
        title="Remove this website"
      >
        🗑️
      </button>
    </div>
  ))
)}

<div className="mt-4" />
        <div className="flex gap-4">
          <FormButton
            text={websitesSaved ? "Saved ✅" : "Save"}
            type="button"
            onClick={saveWebsites}
            className="px-6 py-2"
          />
          <FormButton
            text="Cancel"
            type="button"
            onClick={() => {
              setEditingWebsites(false);
              setWebsiteList(profile?.websites || []);
            }}
            className="px-6 py-2 bg-gray-500 hover:bg-gray-600"
          />
        </div>
      </>
    ) : (
      <>
        {profile?.websites && profile.websites.length > 0 ? (
          <ul className="list-disc list-inside text-blue-400">
            {profile.websites.map((url, index) => (
              <li key={index}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 italic">No websites added yet.</p>
        )}
        <div className="flex justify-center mt-2">
          <FormButton
            text="Edit Websites"
            type="button"
            onClick={() => setEditingWebsites(true)}
            className="text-sm"
          />
        </div>
      </>
    )
  ) : (
    profile?.websites && profile.websites.length > 0 && (
            <ul className="list-disc list-inside text-blue-400">
                {profile.websites.map((url, index) => (
                <li key={index}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {url}
                    </a>
                </li>
                ))}
            </ul>
            )
        )}
        </div>
    </div>
  );
}
