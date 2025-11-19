import type { LoadDeps as Deps, LoadOptions } from '$lib/types/load';
import { ensureFreshToken } from '$lib/utils/keycloak';

/**
 * POST params to an endpoint and surface the parsed result via setJsonContent.
 * Handles auth/header injection, mock responses for tests, error parsing, and optional navigation.
 */
export async function loadFormData(deps: Deps, opts: LoadOptions): Promise<void> {
  const {
    setJsonContent,
    navigate,
    getCookie,
    keycloak = null,
  } = deps;

  const {
    endpoint,
    params = {},
    setLoading,
    includeAuth = true,
    includeOriginalServer = true,
    expectSaveData = false,
    parseErrorBody = true,
    navigateOnError = true,
    onError,
  } = opts;

  if (setLoading) setLoading(true);

try {
    // Use externalized mock helper to avoid impacting the main logic
    const { getMockResponseIfEnabled } = await import("./mockResponses");
    const mock = await getMockResponseIfEnabled(endpoint);
    if (mock !== null) {
      setJsonContent(expectSaveData ? (mock as any)?.save_data : mock);
      return;
    }

    const body: Record<string, any> = { ...params };

    if (includeAuth) {
      const username = getCookie("username");
      if (username && username.trim() !== "") {
        body.username = username.trim();
      } 
      else {
        let token = keycloak?.token ?? (getCookie("token") as string | null) ?? null;
        if (!token) {
          const freshToken = await ensureFreshToken(5);
          token = freshToken ?? null; 
        }
        if(token) {
          body.token = token;
        }
      }
    }
    

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (includeAuth) {
      const token = keycloak?.token ?? (getCookie("token") as string | null) ?? null;
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    if (includeOriginalServer) {
      const originalServer = getCookie("originalServer");
      if (originalServer) headers["X-Original-Server"] = originalServer as string;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (parseErrorBody) {
        let errBody: any = null;
        try {
          errBody = await response.json();
        } catch {
          // ignore parse failure
        }
        const errMsg = (errBody && (errBody.error || errBody.message)) || "Something went wrong";
        throw new Error(errMsg);
      } else {
        throw new Error(`Error: ${response.statusText}`);
      }
    }

    let result: any;
    try {
      result = await response.json();
    } catch {
      const text = await response.text();
      setJsonContent(text);
      return;
    }

    setJsonContent(expectSaveData ? result?.save_data : result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (navigateOnError) {
      try {
        navigate("/error", { state: { message } });
      } catch (navErr) {
        console.error("Navigation failed:", navErr);
      }
    }
    if (onError) onError(message);
    console.error("loadData failed:", err);
  } finally {
    if (setLoading) setLoading(false);
  }
}
