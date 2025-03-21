"use client"; // Gjør Navbar til en klientkomponent

import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center bg-[#145214] p-4 text-white shadow-md">
      <div className="text-2xl font-bold">Magee.no</div>

      <div className="flex justify-between w-full max-w-4xl">
        {/* Venstre links */}
        <ul className="flex gap-6">
          <li>
            <Link href="/" className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition">
              Home
            </Link>
          </li>
          <li>
            <Link href="/weather" className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition">
              Backend sjekk
            </Link>
          </li>
          <li>
            <Link href="/about" className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition">
              About us
            </Link>
          </li>
        </ul>

        {/* Høyre links */}
        <ul className="flex gap-6">
          <li>
            <Link href="/login" className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition">
              Login
            </Link>
          </li>
          <li>
            <Link href="/signup" className="hover:bg-[#0F3D0F] px-4 py-2 rounded-md transition">
              Sign up
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
