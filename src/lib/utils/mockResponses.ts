/** Return a mock response for known endpoints when running under Vitest; else null. */
export async function getMockResponseIfEnabled(endpoint: string): Promise<any | null> {
  const IS_VITEST =
    (import.meta as any).env?.VITE_VITEST === "true" ||
    (import.meta as any).env?.VITEST;

  if (!IS_VITEST) return null;

  // Derive the last segment of the endpoint path
  let last = "";
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const url = new URL(endpoint, base);
    last = url.pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    last = endpoint.split("/").filter(Boolean).pop() || "";
  }

  // Map common endpoints to mock files in /static
  const mockMap: Record<string, string> = {
    // load endpoints
    loadicmdata: "/LoadICMDataResponseAPI.json",
    loadportalform: "/LoadICMDataResponseAPI.json",
    loadsavedjson: "/form_with_data.json",
    // generate endpoints
    generate: "/generateResponseAPI.json",
    generateportalform: "/generateResponseAPI.json",

    //save endpoint
    saveicmdata: "/SaveICMDataResponseAPI.json",
    // unlock endpoint
    clearicmlockedflag: "/clearICMLockedFlagAPI.json",
  };

  const mockUrl = mockMap[last.toLowerCase()];
  if (!mockUrl) return null;

  const res = await fetch(mockUrl);
  if (!res.ok) {
    throw new Error(`Mock fetch failed: ${res.status} ${res.statusText}`);
  }

  // Try JSON first, fall back to text if needed
  try {
    return await res.json();
  } catch {
    return await res.text();
  }
}
