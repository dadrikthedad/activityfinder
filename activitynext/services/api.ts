const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";

/**
 * Denne skal destrueres senere!
 */
export async function fetchData() {
    try {
        const response = await fetch(`${API_BASE_URL}/values`, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error fetching data:", error);
        return null; // Sikrer at feilen ikke krasjer appen
    }
}

/**
 * Henter værdata fra API
 */
export async function fetchWeather() {
    try {
        const response = await fetch(`${API_BASE_URL}/weatherforecast`, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error fetching weather data:", error);
        return null; // Returnerer `null` i stedet for å krasje
    }
}
