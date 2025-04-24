// Søkefeltet til navbaren, brukes foreløpig kun til å søke etter brukere. Henter useUserSearch.ts som henter bruekre fra User.cs i backend.
"use client";
import { useUserSearch } from "@/hooks/useUserSearch";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";

export default function NavbarSearch() {
  const { query, setQuery, results, loading } = useUserSearch();
  const dropdownRef = useRef<HTMLUListElement>(null);

   // Lukk dropdown når man klikker utenfor
   useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setQuery(""); // Tøm søket -> lukk dropdown
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setQuery]);

  return (
    <div className="relative w-full max-w-md mx-auto">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
        className="w-full px-4 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1C6B1C] dark:bg-[#1e2122] dark:text-white text-center"
      />

      {query && (
        <ul
          ref={dropdownRef}
          className="absolute left-1/2 -translate-x-1/2 z-50 w-[800px] mt-2 bg-white dark:bg-[#1e2122] border-4 border-[#1C6B1C] rounded-md shadow-lg max-h-[400px] overflow-auto text-lg"
        >
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
                    width={80}
                    height={80}
                    className="w-17 h-17 rounded-full object-cover"
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