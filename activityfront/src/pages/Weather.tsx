import React, { useEffect, useState } from "react";
import { fetchWeather } from "../services/api";

interface WeatherData {
    date: string;
    temperatureC: number;
    summary: string;
}

const Weather: React.FC = () => {
    const [weather, setWeather] = useState<WeatherData[]>([]);

    useEffect(() => {
        fetchWeather().then((data) => {
            if (data) {
                setWeather(data);
                console.log("Hentet værdata:", data); // ✅ Debugging
            } else {
                console.error("Kunne ikke hente værdata");
            }
        }).catch((error) => {
            console.error("Feil ved henting av værdata:", error);
        });
    }, []);

    return (
        <div className="page-container">
            <h1>Værmelding</h1>
            {weather.length > 0 ? ( // Endret fra Weather.length til weather.length
                <ul>
                    {weather.map((item, index) => (
                        <li key={index}>
                            📅 {item.date}: 🌡️ {item.temperatureC}°C ({item.summary})
                        </li>
                    ))}
                </ul>
            ) : (
                <p>❌ Kunne ikke hente værdata.</p>
            )}
        </div>
    );
};

export default Weather;
