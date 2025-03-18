"use client";
import { useState} from "react";

export default function Signup() {
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    dateOfBirth: "",
    country: "",
    region: "",
    postalCode: "",
    });

    const [message, setMessage] = useState("");

  // Håndterer inputendringer
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const registerUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(""); // Resetter eventuelle feilmeldinger

    try {
      const response = await fetch("https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/api/user/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      let data;
      const isJson = response.headers.get("content-type")?.includes("application/json");
      if (isJson) {
        data = await response.json();
      } else {
        data = {message: "Ukjent feil oppstod."};
      }

      if (response.ok) {
        setMessage("✅ Bruker registrert!");
      } else {
        setMessage("❌ Feil: " + (data.message || "Kunne ikke registrere bruker."));
      }
    } catch (error) {
      console.error("registreringsfeil:", error);
      setMessage("❌ Nettverksfeil. Prøv igjen senere.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 text-center">
      <h1 className="text-4xl font-bold text-blue-600">Registrer deg</h1>
      <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
        Opprett en ny konto for å bli med.
      </p>

      <form onSubmit={registerUser} className="mt-6 flex flex-col gap-4 w-80">
        <input type="text" name="firstName" placeholder="Fornavn" value={formData.firstName} onChange={handleChange} className="px-4 py-2 border rounded-md" />
        <input type="text" name="middleName" placeholder="Mellomnavn (valgfritt)" value={formData.middleName} onChange={handleChange} className="px-4 py-2 border rounded-md" />
        <input type="text" name="lastName" placeholder="Etternavn" value={formData.lastName} onChange={handleChange} className="px-4 py-2 border rounded-md" />
        <input type="email" name="email" placeholder="E-post" value={formData.email} onChange={handleChange} className="px-4 py-2 border rounded-md" />
        <input type="password" name="password" placeholder="Passord" value={formData.password} onChange={handleChange} className="px-4 py-2 border rounded-md" />
        <input type="tel" name="phone" placeholder="Telefonnummer" value={formData.phone} onChange={handleChange} className="px-4 py-2 border rounded-md" />
        <input type="date" name="dateOfBirth" placeholder="Fødselsdato" value={formData.dateOfBirth} onChange={handleChange} className="px-4 py-2 border rounded-md" />
        <input type="text" name="region" placeholder="Region" value={formData.region} onChange={handleChange} className="px-4 py-2 border rounded-md" />
        <input type="text" name="postalCode" placeholder="Postnummer" value={formData.postalCode} onChange={handleChange} className="px-4 py-2 border rounded-md" />
        
        <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition">
          Registrer deg
        </button>
      </form>

      {message && <p className="mt-4 font-semibold text-red-500">{message}</p>}
    </div>
  );
}