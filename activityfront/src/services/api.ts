const API_BASE_URL = "http://localhost:5058/api";

export async function fetchData() {
    const response = await fetch(`${API_BASE_URL}/values`);
    return response.json();
}

export async function fetchWeather() {
    try {
        const response = await fetch("http://localhost:5058/weatherforecast");

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json(); // ✅ Sikrer at vi får JSON
    } catch (error) {
        console.error("Error fetching weather data:", error);
        return null;
    }
}