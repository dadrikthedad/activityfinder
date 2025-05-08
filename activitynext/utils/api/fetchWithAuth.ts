// Dette er en generisk funksjon som henter token, gjør API-kallet, og håndterer feil hvis det oppstår. Brukes til alt hvor vi trenger auth

type LogLevel = "none" | "basic" | "verbose"; // For å bestemme hvor mye som skal vises i loggen

export async function fetchWithAuth<T>(
  url: string,
  options: RequestInit = {},
  token?: string,
  logLevel: LogLevel = "verbose"
): Promise<T | null> {
  const authToken = token || localStorage.getItem("token"); // henter token


  if (!authToken) {
    throw new Error("No auth token found.");
  }

  if (logLevel !== "none") {
    console.log("🟡 fetchWithAuth - URL:", url);
    console.log("🟢 Token (first 20 chars):", authToken?.slice(0, 20));
  }

  const res = await fetch(url, { // Her gjør vi fetch-kallet
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text(); // les alltid som tekst først

  if (!res.ok) {
    if (logLevel !== "none") {
      console.error(`🔴 API error (${res.status}) from ${url}:`, text);
    }
  
    try {
      const json = JSON.parse(text);
  
      if (typeof json === "object" && json !== null && "message" in json) {
        throw new Error(json.message);
      }
  
      throw new Error("Something went wrong.");
    } catch {
      throw new Error(text || "Something went wrong.");
    }
  }

  if (!text || text.trim() === "") {
    if (logLevel === "verbose") console.warn("⚠️ Empty response body");
    return null;
  }

  if (logLevel === "verbose") {
    console.log("📦 Status code:", res.status);
    console.log("📄 Raw text:", text);
  }

  try {
    const json = JSON.parse(text) as T;
    if (logLevel !== "none") {
      console.log("✅ Parsed JSON:", json);
    }
    return json;
  } catch (err) {
    if (logLevel !== "none") {
      console.error("❌ Invalid JSON response:", text, err);
    }
    return null;
  }
}