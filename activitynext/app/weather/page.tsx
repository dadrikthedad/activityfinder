"use client"; // 👈 Sørger for at dette kjører i browseren

import { useEffect, useState } from "react";

interface WeatherData {
  date: string;
  temperatureC: number;
  summary: string;
}

export default function WeatherPage() {
  const [weather, setWeather] = useState<WeatherData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(
          "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/weatherforecast"
        );

        if (!res.ok) throw new Error("Kunne ikke hente værdata");

        const data = await res.json();
        setWeather(data);
      } catch (err) {
        setError("❌ Feil ved henting av værdata.");
        console.error("Feil ved henting av værdata:", err);
      }
    }

    fetchWeather();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg">
      <h1 className="text-2xl font-bold text-blue-600">Værmelding</h1>

      {error ? (
        <p className="text-red-500 mt-4 font-semibold">{error}</p>
      ) : weather.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {weather.map((item, index) => (
            <li key={index} className="p-4 border rounded-md bg-gray-100 dark:bg-gray-700">
              📅 {item.date}: 🌡️ {item.temperatureC}°C ({item.summary})
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 mt-4">Laster værdata...</p>
      )}
    </div>
  );
}
