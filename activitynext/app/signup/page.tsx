import React from "react";

export default function Signup() {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 text-center">
        <h1 className="text-4xl font-bold text-blue-600">Registrer deg</h1>
        <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
          Opprett en ny konto for å bli med.
        </p>
  
        <form className="mt-6 flex flex-col gap-4 w-80">
          <input
            type="email"
            placeholder="E-post"
            className="px-4 py-2 border rounded-md"
          />
          <input
            type="password"
            placeholder="Passord"
            className="px-4 py-2 border rounded-md"
          />
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition">
            Registrer deg
          </button>
        </form>
      </div>
    );
  }
  