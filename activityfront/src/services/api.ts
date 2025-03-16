const API_BASE_URL = "https://activityfinder-gnaacbg9gsgjh7b7.swedencentral-01.azurewebsites.net";

export async function fetchData() {
    const response = await fetch(`${API_BASE_URL}/values`);
    return response.json();
}

export async function fetchWeather() {
    try {
        const response = await fetch(`${API_BASE_URL}/weatherforecast`);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json(); // ✅ Sikrer at vi får JSON
    } catch (error) {
        console.error("Error fetching weather data:", error);
        return null;
    }
}