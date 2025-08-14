type Params = { [key: string]: string | null };

type Deps = {
  setJsonContent: (data: any) => void;
  navigate: (path: string, opts?: { state?: { message?: string } }) => void;
  getCookie: (name: string) => string | null | undefined;
  keycloak?: { token?: string | null } | null;
};

/**
 * Options controlling behavior so this one function can replace your multiple handlers.
 */
type LoadOptions = {
  endpoint: string;                  // the full endpoint to POST to (e.g. API.generate)
  params?: Params;                   // body params
  setLoading?: (v: boolean) => void; // optional loading setter (same as setIsNewPageLoading etc.)
  includeAuth?: boolean;             // if true add token OR username (match original handlers)
  includeOriginalServer?: boolean;   // include X-Original-Server header (default true)
  expectSaveData?: boolean;          // if true call setJsonContent(result.save_data)
  parseErrorBody?: boolean;          // if true try to parse JSON error body and use its error/message field
  navigateOnError?: boolean;         // if true navigate("/error", { state: { message } }) on error
  onError?: (message: string) => void; // optional error callback for callers to handle errors
};

/**
 * loadData - a single reusable function to POST params to an endpoint and handle response.
 *
 * Preserves these behaviors from your original handlers:
 *  - adds token from keycloak.token, otherwise uses username cookie when includeAuth is true
 *  - optionally attaches X-Original-Server header from cookie
 *  - supports two error-parsing semantics via parseErrorBody
 *  - sets an optional loading flag while request runs
 *  - optionally uses result.save_data vs result when calling setJsonContent
 *  - optionally navigates to /error on error (with message)
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

    // Build request body
    const body: Record<string, any> = { ...params };

    if (includeAuth) {
      const token = keycloak?.token ?? (getCookie("token") as string | null) ?? null;
      if (token) {
        body.token = token;
      } else {
        const username = getCookie("username");
        if (username) body.username = username.trim();
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
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
