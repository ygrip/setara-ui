export type SetaraRole = 'ADMIN' | 'QA' | 'VIEWER';

export type SetaraSession = {
  email: string;
  name: string;
  role: SetaraRole;
  permissions: string[];
  accessToken: string;
  expiresAt: string;
  refreshExpiresAt: string;
};

const SESSION_KEY = 'setara_session';
const REFRESH_KEY = 'setara_refresh';
const ACCESS_TTL_MS = 30 * 60 * 1000;
const REFRESH_TTL_MS = 8 * 60 * 60 * 1000;

const ROLE_PERMISSIONS: Record<SetaraRole, string[]> = {
  ADMIN: ['project:read', 'project:write', 'scenario:read', 'scenario:write', 'execution:read', 'plan:read', 'plan:write', 'settings:read', 'settings:write', 'user:read', 'user:write'],
  QA: ['project:read', 'scenario:read', 'scenario:write', 'execution:read', 'plan:read', 'plan:write', 'settings:read'],
  VIEWER: ['project:read', 'scenario:read', 'execution:read', 'plan:read']
};

export function createMockSession(email: string, name: string, role: SetaraRole = 'ADMIN'): SetaraSession {
  const now = Date.now();
  return {
    email,
    name,
    role,
    permissions: ROLE_PERMISSIONS[role],
    accessToken: `mock_access_${crypto.randomUUID?.() ?? now}`,
    expiresAt: new Date(now + ACCESS_TTL_MS).toISOString(),
    refreshExpiresAt: new Date(now + REFRESH_TTL_MS).toISOString()
  };
}

export function storeSession(session: SetaraSession) {
  const json = JSON.stringify(session);
  sessionStorage.setItem(SESSION_KEY, json);
  localStorage.setItem(SESSION_KEY, json);
  localStorage.setItem(REFRESH_KEY, JSON.stringify({ email: session.email, refreshExpiresAt: session.refreshExpiresAt }));
}

export function getSession(): SetaraSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return normalizeSession(JSON.parse(raw));
  } catch {
    clearSession();
    return null;
  }
}

export function getValidSession(): SetaraSession | null {
  const session = getSession();
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() > Date.now()) return session;
  return refreshSession();
}

export function refreshSession(): SetaraSession | null {
  const session = getSession();
  if (!session) return null;
  if (new Date(session.refreshExpiresAt).getTime() <= Date.now()) {
    clearSession();
    return null;
  }
  const refreshed: SetaraSession = {
    ...session,
    accessToken: `mock_access_${crypto.randomUUID?.() ?? Date.now()}`,
    expiresAt: new Date(Date.now() + ACCESS_TTL_MS).toISOString()
  };
  storeSession(refreshed);
  return refreshed;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function hasPermission(session: SetaraSession | null, permission: string) {
  return !!session?.permissions?.includes(permission);
}

function normalizeSession(raw: Partial<SetaraSession>): SetaraSession {
  const role = raw.role ?? 'ADMIN';
  const now = Date.now();
  return {
    email: raw.email ?? '',
    name: raw.name ?? raw.email ?? 'Setara User',
    role,
    permissions: raw.permissions?.length ? raw.permissions : ROLE_PERMISSIONS[role],
    accessToken: raw.accessToken ?? `mock_access_${now}`,
    expiresAt: raw.expiresAt ?? new Date(now + ACCESS_TTL_MS).toISOString(),
    refreshExpiresAt: raw.refreshExpiresAt ?? new Date(now + REFRESH_TTL_MS).toISOString()
  };
}
