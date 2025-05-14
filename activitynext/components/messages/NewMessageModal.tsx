// New message modal som brukes for å sende en melding til en bruker
"use client";

import { useUserSearch } from "@/hooks/useUserSearch";
import { UserSummaryDTO } from "@/types/UserSummaryDTO";
import Image from "next/image";
import { useState } from "react";
import MessageInput from "./MessageInput";
import { useModal } from "@/context/ModalContext";

export default function NewMessageModal() {
  const { hideModal } = useModal();
  const { query, setQuery, results, loading } = useUserSearch();

  const [selectedUser, setSelectedUser] = useState<UserSummaryDTO | null>(null);

  return (
    <div className="p-6 text-black dark:text-white">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Ny melding</h2>
        <button onClick={hideModal} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-white">
          Lukk
        </button>
      </div>

      {/* Søkefelt */}
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedUser(null);
        }}
        placeholder="Søk etter bruker..."
        className="w-full p-2 mb-2 border rounded dark:bg-[#1e2122] dark:border-gray-600"
      />

      {/* Søkeresultater */}
      {query && (
        <ul className="w-full border rounded bg-white dark:bg-[#1e2122] max-h-60 overflow-auto mb-4">
          {loading && <li className="p-2 text-center">Laster...</li>}

          {!loading && results.length === 0 && (
            <li className="p-2 text-center text-gray-500">Ingen brukere funnet</li>
          )}

          {!loading &&
            results.map((user) => (
              <li
                key={user.id}
                className="p-2 hover:bg-gray-100 dark:hover:bg-[#2a2e31] cursor-pointer flex gap-3 items-center"
                onClick={() => {
                  setSelectedUser(user);
                  setQuery("");
                }}
              >
                <Image
                  src={user.profileImageUrl ?? "/default-avatar.png"}
                  alt={user.fullName}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
                <span>{user.fullName}</span>
              </li>
            ))}
        </ul>
      )}

      {/* Meldingsinput for valgt bruker */}
      {selectedUser && (
        <div className="mt-4">
          <p className="mb-2">
            Sender melding til: <strong>{selectedUser.fullName}</strong>
          </p>

          <MessageInput
            receiverId={selectedUser.id}
            onMessageSent={(message) => {
              console.log("Melding sendt!", message);
              hideModal();
            }}
          />
        </div>
      )}
    </div>
  );
}
