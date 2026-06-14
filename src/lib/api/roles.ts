import { apiFetch } from './client';
import { readJsonOrThrow } from './errors';
import { isMockMode } from '$lib/mock/client';

export interface ConfigRole {
  id: string;
  key: string;
  label: string;
  description: string | null;
  color: string;
  system: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AvailablePermission {
  area: string;
  key: string;
  label: string;
}

export async function listConfigRoles(): Promise<ConfigRole[]> {
  if (isMockMode()) return mockConfigRoles;
  const res = await apiFetch('/api/admin/roles');
  return readJsonOrThrow(res);
}

export async function getConfigRole(id: string): Promise<ConfigRole> {
  const res = await apiFetch(`/api/admin/roles/${id}`);
  return readJsonOrThrow(res);
}

export async function createConfigRole(body: { key: string; label: string; description?: string | null; color?: string | null }): Promise<ConfigRole> {
  if (isMockMode()) {
    const newRole: ConfigRole = { id: String(Date.now()), key: body.key, label: body.label, description: body.description ?? null, color: body.color ?? 'info', system: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    mockConfigRoles.push(newRole);
    mockRolePermissions[body.key] = [];
    return newRole;
  }
  const res = await apiFetch('/api/admin/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow(res);
}

export async function updateConfigRole(id: string, body: { label?: string; description?: string | null; color?: string | null }): Promise<ConfigRole> {
  if (isMockMode()) {
    const role = mockConfigRoles.find(r => r.id === id);
    if (!role) throw new Error('Role not found');
    if (body.label) role.label = body.label;
    if (body.description !== undefined) role.description = body.description;
    if (body.color) role.color = body.color;
    return role;
  }
  const res = await apiFetch(`/api/admin/roles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonOrThrow(res);
}

export async function deleteConfigRole(id: string): Promise<void> {
  if (isMockMode()) {
    const idx = mockConfigRoles.findIndex(r => r.id === id);
    if (idx >= 0) mockConfigRoles.splice(idx, 1);
    return;
  }
  await apiFetch(`/api/admin/roles/${id}`, { method: 'DELETE' });
}

export async function getRolePermissions(id: string): Promise<string[]> {
  if (isMockMode()) {
    const role = mockConfigRoles.find(r => r.id === id);
    return role ? (mockRolePermissions[role.key] ?? []) : [];
  }
  const res = await apiFetch(`/api/admin/roles/${id}/permissions`);
  return readJsonOrThrow(res);
}

export async function setRolePermissions(id: string, entries: { area: string; permissionKey: string }[]): Promise<string[]> {
  if (isMockMode()) {
    const role = mockConfigRoles.find(r => r.id === id);
    if (role) mockRolePermissions[role.key] = entries.map(e => `${e.area}:${e.permissionKey}`);
    return role ? (mockRolePermissions[role.key] ?? []) : [];
  }
  const res = await apiFetch(`/api/admin/roles/${id}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entries)
  });
  return readJsonOrThrow(res);
}

export async function listAvailablePermissions(): Promise<AvailablePermission[]> {
  if (isMockMode()) return mockPermissions;
  const res = await apiFetch('/api/admin/roles/available-permissions');
  return readJsonOrThrow(res);
}

export const mockConfigRoles: ConfigRole[] = [
  { id: '1', key: 'ADMIN', label: 'Admin', description: 'Full platform access.', color: 'danger', system: true, createdAt: null, updatedAt: null },
  { id: '2', key: 'QA_LEAD', label: 'QA Lead', description: 'Manages test repository and release plans.', color: 'warning', system: false, createdAt: null, updatedAt: null },
  { id: '3', key: 'QA', label: 'QA Engineer', description: 'Full access to executions and test cases.', color: 'info', system: false, createdAt: null, updatedAt: null },
  { id: '4', key: 'DEVELOPER', label: 'Developer', description: 'Read access to executions and coverage.', color: 'success', system: false, createdAt: null, updatedAt: null },
  { id: '5', key: 'VIEWER', label: 'Viewer', description: 'Read-only access to dashboards.', color: 'neutral', system: true, createdAt: null, updatedAt: null }
];

// Default permission sets per role key (matching DB seed)
export const mockRolePermissions: Record<string, string[]> = {
  ADMIN: [
    'Organization:org:read', 'Organization:org:write', 'Organization:org:admin',
    'Organization:apikey:manage', 'Organization:admin:access',
    'Projects:project:read', 'Projects:project:create', 'Projects:project:edit', 'Projects:coverage:read',
    'Test Repository:scenario:read', 'Test Repository:scenario:write', 'Test Repository:scenario:approve',
    'Test Repository:scenario:archive', 'Test Repository:directory:manage', 'Test Repository:scenario:import',
    'Test Repository:map:read',
    'Executions:execution:read', 'Executions:execution:trigger', 'Executions:execution:ingest',
    'Release Plans:plan:read', 'Release Plans:plan:write', 'Release Plans:plan:close', 'Release Plans:plan:archive',
    'Builds:build:read', 'Builds:build:write', 'Builds:build:verify'
  ],
  QA_LEAD: [
    'Organization:org:read',
    'Projects:project:read', 'Projects:project:edit', 'Projects:coverage:read',
    'Test Repository:scenario:read', 'Test Repository:scenario:write', 'Test Repository:scenario:approve',
    'Test Repository:scenario:archive', 'Test Repository:directory:manage', 'Test Repository:scenario:import',
    'Test Repository:map:read',
    'Executions:execution:read', 'Executions:execution:trigger', 'Executions:execution:ingest',
    'Release Plans:plan:read', 'Release Plans:plan:write', 'Release Plans:plan:close', 'Release Plans:plan:archive',
    'Builds:build:read', 'Builds:build:write', 'Builds:build:verify'
  ],
  QA: [
    'Organization:org:read',
    'Projects:project:read', 'Projects:coverage:read',
    'Test Repository:scenario:read', 'Test Repository:scenario:write',
    'Test Repository:scenario:archive', 'Test Repository:scenario:import', 'Test Repository:map:read',
    'Executions:execution:read', 'Executions:execution:trigger', 'Executions:execution:ingest',
    'Release Plans:plan:read', 'Release Plans:plan:write',
    'Builds:build:read', 'Builds:build:write'
  ],
  DEVELOPER: [
    'Organization:org:read',
    'Projects:project:read', 'Projects:coverage:read',
    'Test Repository:scenario:read', 'Test Repository:map:read',
    'Executions:execution:read', 'Executions:execution:trigger', 'Executions:execution:ingest',
    'Release Plans:plan:read',
    'Builds:build:read'
  ],
  VIEWER: [
    'Organization:org:read',
    'Projects:project:read', 'Projects:coverage:read',
    'Test Repository:scenario:read', 'Test Repository:map:read',
    'Executions:execution:read',
    'Release Plans:plan:read',
    'Builds:build:read'
  ]
};

export const mockPermissions: AvailablePermission[] = [
  { area: 'Organization', key: 'org:read', label: 'View tribes & squads' },
  { area: 'Organization', key: 'org:write', label: 'Create / edit tribes & squads' },
  { area: 'Organization', key: 'org:admin', label: 'Manage users & assignments' },
  { area: 'Organization', key: 'apikey:manage', label: 'Manage project API keys' },
  { area: 'Organization', key: 'admin:access', label: 'View admin panel' },
  { area: 'Projects', key: 'project:read', label: 'View project dashboard' },
  { area: 'Projects', key: 'project:create', label: 'Create new projects' },
  { area: 'Projects', key: 'project:edit', label: 'Edit project settings' },
  { area: 'Projects', key: 'coverage:read', label: 'View coverage metrics' },
  { area: 'Test Repository', key: 'scenario:read', label: 'View scenarios & directories' },
  { area: 'Test Repository', key: 'scenario:write', label: 'Create / edit scenarios' },
  { area: 'Test Repository', key: 'scenario:approve', label: 'Approve / reject drafts' },
  { area: 'Test Repository', key: 'scenario:archive', label: 'Archive scenarios' },
  { area: 'Test Repository', key: 'directory:manage', label: 'Manage directories' },
  { area: 'Test Repository', key: 'scenario:import', label: 'Bulk import scenarios' },
  { area: 'Test Repository', key: 'map:read', label: 'View quality / coverage maps' },
  { area: 'Executions', key: 'execution:read', label: 'View executions' },
  { area: 'Executions', key: 'execution:trigger', label: 'Trigger manual run' },
  { area: 'Executions', key: 'execution:ingest', label: 'Ingest via API key' },
  { area: 'Release Plans', key: 'plan:read', label: 'View release plans' },
  { area: 'Release Plans', key: 'plan:write', label: 'Create / edit plans' },
  { area: 'Release Plans', key: 'plan:close', label: 'Close plans' },
  { area: 'Builds', key: 'build:read', label: 'View builds' },
  { area: 'Builds', key: 'build:write', label: 'Create / manage builds' },
  { area: 'Builds', key: 'build:verify', label: 'Verify builds' }
];
