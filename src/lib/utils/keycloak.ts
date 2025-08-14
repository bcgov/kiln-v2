import Keycloak from 'keycloak-js';
import type {
	KeycloakInstance,
	KeycloakInitOptions,
	KeycloakLoginOptions
} from 'keycloak-js';

let kc: KeycloakInstance | null = null;
let initPromise: Promise<KeycloakInstance> | null = null;

const isStandaloneMode = import.meta.env.VITE_STANDALONE_MODE === 'true';
const isPortalIntegrated = import.meta.env.VITE_IS_PORTAL_INTEGRATED === 'true';

function buildKeycloak(): KeycloakInstance {
	return new Keycloak({
		url: import.meta.env.VITE_SSO_AUTH_SERVER_URL as string,
		realm: import.meta.env.VITE_SSO_REALM as string,
		clientId: import.meta.env.VITE_SSO_CLIENT_ID as string
	});
}

export async function initializeKeycloak(): Promise<KeycloakInstance> {
	if (kc) return kc;
	if (initPromise) return initPromise;

	initPromise = (async () => {
		const instance = buildKeycloak();

		// Refresh token shortly before expiry
		instance.onTokenExpired = () => {
			instance.updateToken(5).catch((err) => console.error('Failed to update token:', err));
		};

		const initOptions: KeycloakInitOptions = {
			pkceMethod: 'S256',
			checkLoginIframe: false,
			onLoad: 'check-sso'
		};

		await instance.init(initOptions);

		if (typeof window !== 'undefined') {
			const hasAuthParams =
				window.location.search.includes('code=') || window.location.search.includes('state=');
			if (hasAuthParams) window.history.replaceState({}, document.title, window.location.pathname);
		}

		kc = instance;
		return instance;
	})();

	return initPromise;
}

export function getKeycloak(): KeycloakInstance | null {
	return kc;
}

export async function guardRoute(
	type: 'public' | 'private'
): Promise<{ keycloak: KeycloakInstance | null; authenticated: boolean }> {
	// Standalone mode and portal integration bypass auth
	if (isStandaloneMode || isPortalIntegrated || type === 'public') {
		return { keycloak: null, authenticated: true };
	}

	const keycloak = await initializeKeycloak();

	if (!keycloak.authenticated) {
		const loginOptions: KeycloakLoginOptions = {
			redirectUri: typeof window !== 'undefined' ? window.location.href : undefined
		};
		await keycloak.login(loginOptions);
		return { keycloak, authenticated: false };
	}

	return { keycloak, authenticated: !!keycloak.authenticated };
}

export function isAuthenticated(): boolean {
	return !!kc?.authenticated;
}

export async function ensureFreshToken(minValiditySeconds = 5): Promise<string | undefined> {
	const keycloak = await initializeKeycloak();
	if (!keycloak.authenticated) return undefined;
	try {
		await keycloak.updateToken(minValiditySeconds);
	} catch (err) {
		console.error('Failed to refresh token:', err);
		return undefined;
	}
	return keycloak.token ?? undefined;
}

export async function getAuthHeader():
	Promise<Record<'Authorization', string> | undefined> {
	const token = await ensureFreshToken(5);
	return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export function logout(): void {
	const ssoAuthServer = import.meta.env.VITE_SSO_AUTH_SERVER_URL as string;
	const ssoRealm = import.meta.env.VITE_SSO_REALM as string;
	const ssoRedirectUri = import.meta.env.VITE_SSO_REDIRECT_URI as string;
	const ssoClientId = import.meta.env.VITE_SSO_CLIENT_ID as string;

	const retUrl =
		`${ssoAuthServer}/realms/${encodeURIComponent(ssoRealm)}` +
		`/protocol/openid-connect/logout?post_logout_redirect_uri=${encodeURIComponent(ssoRedirectUri)}` +
		`&client_id=${encodeURIComponent(ssoClientId)}`;

	if (typeof window !== 'undefined') {
		window.location.href =
			`https://logon7.gov.bc.ca/clp-cgi/logoff.cgi?retnow=1&returl=${encodeURIComponent(retUrl)}`;
	}
}

export const env = {
	isStandaloneMode,
	isPortalIntegrated
} as const;
