import { getKeycloak, getAuthHeader } from './keycloak';

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
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

  // Add Original-Server header if available
  if (typeof window !== 'undefined') {
    const originalServer = getCookie('originalServer');
    if (originalServer) {
      headers['X-Original-Server'] = originalServer;
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