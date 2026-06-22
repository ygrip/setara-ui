export type SetaraRole = 'GUEST' | 'SYSTEM_ADMIN' | 'ADMIN' | 'QA_LEAD' | 'QA' | 'DEVELOPER' | 'VIEWER';

export type SetaraSession = {
  email: string;
  name: string;
  role: SetaraRole;
  permissions: string[];
  accessToken: string;
  expiresAt: string;
  pendingPasswordChange?: boolean;
};

const SESSION_KEY = 'setara_session';

const ROLE_PERMISSIONS: Record<SetaraRole, string[]> = {
  GUEST:        ['project:read', 'scenario:read', 'execution:read', 'plan:read'],
  VIEWER:       ['project:read', 'scenario:read', 'execution:read', 'plan:read', 'build:read'],
  DEVELOPER:    ['project:read', 'scenario:read', 'execution:read', 'execution:write', 'plan:read', 'build:read'],
  QA:           ['project:read', 'scenario:read', 'scenario:write', 'execution:read', 'execution:write', 'plan:read', 'plan:write', 'settings:read', 'build:read', 'build:write', 'build:verify'],
  QA_LEAD:      ['project:read', 'project:write', 'scenario:read', 'scenario:write', 'execution:read', 'execution:write', 'plan:read', 'plan:write', 'settings:read', 'settings:write', 'build:read', 'build:write', 'build:verify'],
  ADMIN:        ['project:read', 'project:write', 'scenario:read', 'scenario:write', 'execution:read', 'execution:write', 'plan:read', 'plan:write', 'settings:read', 'settings:write', 'user:read', 'user:write', 'build:read', 'build:write', 'build:verify'],
  SYSTEM_ADMIN: ['project:read', 'project:write', 'scenario:read', 'scenario:write', 'execution:read', 'execution:write', 'plan:read', 'plan:write', 'settings:read', 'settings:write', 'user:read', 'user:write', 'build:read', 'build:write', 'build:verify'],
};

export function sessionFromLoginResult(result: {
  token: string;
  email: string;
  displayName: string;
  systemRole: string;
  expiresAt: string;
  pendingPasswordChange?: boolean;
}): SetaraSession {
  const role = (result.systemRole as SetaraRole) in ROLE_PERMISSIONS
    ? (result.systemRole as SetaraRole)
    : 'GUEST';
  return {
    email: result.email,
    name: result.displayName,
    role,
    permissions: ROLE_PERMISSIONS[role],
    accessToken: result.token,
    expiresAt: result.expiresAt,
    pendingPasswordChange: result.pendingPasswordChange ?? false,
  };
}

export function storeSession(session: SetaraSession) {
  const json = JSON.stringify(session);
  sessionStorage.setItem(SESSION_KEY, json);
  localStorage.setItem(SESSION_KEY, json);
}

export function getSession(): SetaraSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SetaraSession;
  } catch {
    clearSession();
    return null;
  }
}

export function getValidSession(): SetaraSession | null {
  const session = getSession();
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() > Date.now()) return session;
  clearSession();
  return null;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function hasPermission(session: SetaraSession | null, permission: string) {
  return !!session?.permissions?.includes(permission);
}
