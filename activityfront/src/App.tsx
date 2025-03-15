import React, { useEffect, useState } from "react";
import { fetchWeather } from "./services/api";

function App() {
    const [weather, setWeather] = useState<any[]>([]);

    useEffect(() => {
        fetchWeather().then((data) => {
            if (data) {
                setWeather(data);
                console.log("Data fra API:", data); // ✅ Sjekk at vi får riktig data
            } else {
                console.error("Kunne ikke hente værdata");
            }
        });
    }, []);

    return (
        <div>
            <h1>Værmelding fra .NET API</h1>
            {weather && weather.length > 0 ? (
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
}

export default App;
