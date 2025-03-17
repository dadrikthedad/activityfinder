interface WeatherData {
    date: string;
    temperatureC: number;
    summary: string;
  }
  
  async function getWeather(): Promise<WeatherData[]> {
    try {
      const res = await fetch("https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net/weatherforecast", {
        cache: "no-store", // Hindrer caching for ferske værdata
        }
      );
  
      if (!res.ok) {
        throw new Error("Kunne ikke hente værdata");
      }
  
      return await res.json(); // 🔥 Husk `await`!
    } catch (error) {
      console.error("Feil ved henting av værdata:", error);
      return [];
    }
  }
  
  // Next.js Server Component
  export default async function WeatherPage() {
    const weather = await getWeather(); // Henter data på serveren
  
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 shadow-md rounded-lg">
        <h1 className="text-2xl font-bold text-blue-600">Værmelding</h1>
  
        {weather.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {weather.map((item, index) => (
              <li
                key={index}
                className="p-4 border rounded-md bg-gray-100 dark:bg-gray-700"
              >
                📅 {item.date}: 🌡️ {item.temperatureC}°C ({item.summary})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-red-500 mt-4 font-semibold">❌ Kunne ikke hente værdata.</p>
        )}
      </div>
    );
  }
  