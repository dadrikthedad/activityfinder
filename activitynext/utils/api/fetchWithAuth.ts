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

    // Forsøk å parse JSON bare hvis det ser ut som JSON
    if (text.startsWith("{")) {
      try {
        const errorJson = JSON.parse(text);
        throw new Error(errorJson.message || "Something went wrong.");
      } catch {
        throw new Error("Something went wrong (invalid error JSON).");
      }
    } else {
      throw new Error("Something went wrong (non-JSON error response).");
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