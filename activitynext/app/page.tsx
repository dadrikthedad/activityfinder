import Image from "next/image";
// Homesiden tror jeg
export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 text-center">
      <h1 className="text-4xl font-bold text-blue-600">Velkommen til Magee.no</h1>
      <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
        Startsiden.
      </p>

      {/* Bilde for design eller branding */}
      <div className="mt-6">
        <Image
          src="/logo.png" // Bytt ut med riktig logo
          alt="Magee.no Logo"
          width={150}
          height={150}
        />
      </div>

      {/* Knapper for navigasjon */}
      <div className="mt-8 flex gap-4">
        <a
          className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
          href="/signup"
        >
          Bli med nå!
        </a>
        <a
          className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg text-lg font-semibold hover:bg-gray-300 transition"
          href="/login"
        >
          Logg inn
        </a>
      </div>
    </div>
  );
}