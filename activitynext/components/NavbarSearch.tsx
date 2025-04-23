// Søkefeltet til navbaren, brukes foreløpig kun til å søke etter brukere. Henter useUserSearch.ts som henter bruekre fra User.cs i backend.
"use client";
import { useUserSearch } from "@/hooks/useUserSearch";
import Link from "next/link";
import Image from "next/image";

export default function NavbarSearch() {
  const { query, setQuery, results, loading } = useUserSearch();

  return (
    <div className="relative w-full max-w-md mx-auto">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search profiles..."
        className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1C6B1C] dark:bg-[#1e2122] dark:text-white"
      />

      {query && (
        <ul className="absolute z-50 w-full mt-2 bg-white dark:bg-[#1e2122] border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {loading && <li className="p-2 text-center">Loading...</li>}

          {!loading && results.length === 0 && (
            <li className="p-2 text-center text-gray-500">No users found</li>
          )}

          {!loading &&
            results.map((user) => (
              <li
                key={user.id}
                className="p-2 hover:bg-gray-100 dark:hover:bg-[#2a2e31]"
              >
                <Link
                  href={`/profile/${user.id}`}
                  className="flex items-center gap-3"
                >
                  <Image
                    src={user.profileImageUrl ?? "/default-avatar.png"}
                    alt={user.fullName}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover"
                    />
                  <span>{user.fullName}</span>
                </Link>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}