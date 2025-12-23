import { getKeycloak, getAuthHeader } from './keycloak';

function getOriginalServerHeader(): Record<string, string> {
  try {
    // 1) URL ?originalServer=...
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromQs = params.get('originalServer');
      if (fromQs && fromQs.trim()) return { 'X-Original-Server': fromQs.trim() };

      // 2) local/session storage
      const fromStore =
        localStorage.getItem('originalServer') || sessionStorage.getItem('originalServer');
      if (fromStore && fromStore.trim()) return { 'X-Original-Server': fromStore.trim() };

      // 3) global set by host page (optional)
      const g = (window as any).__kilnOriginalServer;
      if (g && typeof g === 'string' && g.trim()) return { 'X-Original-Server': g.trim() };
      
      // 4) cookie fallback
      const originalServerCookie = getCookie('originalServer');
       if (originalServerCookie) { return { 'X-Original-Server': originalServerCookie };
       }
    }
  } catch {
    // ignore
  }
  return {};
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getOriginalServerHeader(),
  };

  try {
    // Try to get fresh token from keycloak
    const authHeader = await getAuthHeader();
    if (authHeader?.Authorization) {
      headers.Authorization = authHeader.Authorization;
    }
  } catch (error) {
    // Fallback to cookie-based auth
    if (typeof window !== 'undefined') {
      const username = getCookie('username');
      // Note: For cookie-based auth, username goes in body, not headers
    }
  }

  return headers;
}

export function getAuthBody(): Record<string, any> {
  const body: Record<string, any> = {};

  if (typeof window !== 'undefined') {
    const keycloak = getKeycloak();

    if (keycloak?.token) {
      body.token = keycloak.token;
    } else {
      // Fallback to cookie-based username
      const username = getCookie('username');
      if (username && username.length > 0) {
        body.username = username.trim();
      }
    }
  }

  return body;
}

function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    return cookieValue ? decodeURIComponent(cookieValue) : null;
  }
  return null;
}