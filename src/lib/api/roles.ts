import { getApiBaseUrl } from './config';
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

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

export async function listConfigRoles(): Promise<ConfigRole[]> {
  if (isMockMode()) return mockConfigRoles;
  const res = await apiFetch('/api/admin/roles');
  return res.json();
}

export async function getConfigRole(id: string): Promise<ConfigRole> {
  const res = await apiFetch(`/api/admin/roles/${id}`);
  return res.json();
}

export async function createConfigRole(body: { key: string; label: string; description?: string | null; color?: string | null }): Promise<ConfigRole> {
  const res = await apiFetch('/api/admin/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function updateConfigRole(id: string, body: { label?: string; description?: string | null; color?: string | null }): Promise<ConfigRole> {
  const res = await apiFetch(`/api/admin/roles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function deleteConfigRole(id: string): Promise<void> {
  await apiFetch(`/api/admin/roles/${id}`, { method: 'DELETE' });
}

export async function getRolePermissions(id: string): Promise<string[]> {
  const res = await apiFetch(`/api/admin/roles/${id}/permissions`);
  return res.json();
}

export async function setRolePermissions(id: string, entries: { area: string; permissionKey: string }[]): Promise<string[]> {
  const res = await apiFetch(`/api/admin/roles/${id}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entries)
  });
  return res.json();
}

export async function listAvailablePermissions(): Promise<AvailablePermission[]> {
  if (isMockMode()) return mockPermissions;
  const res = await apiFetch('/api/admin/roles/available-permissions');
  return res.json();
}

export const mockConfigRoles: ConfigRole[] = [
  { id: '1', key: 'ADMIN', label: 'Admin', description: 'Full platform access.', color: 'danger', system: true, createdAt: null, updatedAt: null },
  { id: '2', key: 'QA_LEAD', label: 'QA Lead', description: 'Manages test repository and release plans.', color: 'warning', system: false, createdAt: null, updatedAt: null },
  { id: '3', key: 'QA', label: 'QA Engineer', description: 'Full access to executions and test cases.', color: 'info', system: false, createdAt: null, updatedAt: null },
  { id: '4', key: 'DEVELOPER', label: 'Developer', description: 'Read access to executions and coverage.', color: 'success', system: false, createdAt: null, updatedAt: null },
  { id: '5', key: 'VIEWER', label: 'Viewer', description: 'Read-only access to dashboards.', color: 'neutral', system: true, createdAt: null, updatedAt: null }
];

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
