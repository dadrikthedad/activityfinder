export async function fetchWithAuth<T>(
  url: string,
  options: RequestInit = {},
  token?: string
): Promise<T | null> {
  const authToken = token || localStorage.getItem("token");

  console.log("🟡 fetchWithAuth - URL:", url);
  console.log("🟢 Token (first 20 chars):", authToken?.slice(0, 20));

  if (!authToken) {
    throw new Error("No auth token found.");
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
  });

  const text = await res.text(); // les alltid som tekst først

  if (!res.ok) {
    console.error(`🔴 API error (${res.status}) from ${url}:`, text);
  
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
    console.warn("⚠️ Empty response body");
    return null;
  }

  try {
    const json = JSON.parse(text) as T;
    console.log("✅ Parsed JSON:", json);
    return json;
  } catch (err) {
    console.error("❌ Invalid JSON response (not parseable):", text, err);
    return null;
  }
}