export async function fetchWithAuth<T = unknown>(
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

  const text = await res.text(); // 👈 alltid les som tekst først

  if (!res.ok) {
    console.error("🔴 API error response (status", res.status, "):", text);
    try {
      const errorJson = JSON.parse(text);
      throw new Error(errorJson.message || "Something went wrong.");
    } catch {
      throw new Error("Something went wrong.");
    }
  }

  // 👉 håndter tomt body (f.eks. ved 204 No Content)
  if (!text || text.trim() === "") {
    console.warn("⚠️ Empty response body");
    return null;
  }

  try {
    const json = JSON.parse(text) as T;
    console.log("✅ Parsed JSON:", json);
    return json;
  } catch (err) {
    console.error("❌ Invalid JSON response:", text, err);
    return null; // 👈 Ikke kast error her – returner bare null
  }
}