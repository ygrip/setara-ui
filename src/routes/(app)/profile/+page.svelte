<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import { clearSession, getValidSession, storeSession, type SetaraSession } from '$lib/auth';
  import { changePassword } from '$lib/api/client';
  import { isMockMode } from '$lib/mock/client';

  let session = $state<SetaraSession | null>(null);
  const isDemo = isMockMode();
  const mustChangePassword = $derived(!!session?.pendingPasswordChange);
  const reason = $derived(browser ? page.url.searchParams.get('reason') : null);

  // Change password form
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let pwLoading = $state(false);
  let pwError = $state('');
  let pwToast = $state('');

  onMount(() => {
    session = getValidSession();
    if (!session) { goto('/login'); return; }
  });

  function signOut() {
    clearSession();
    goto('/login');
  }

  async function handleChangePassword() {
    pwError = '';
    pwToast = '';

    if (!newPassword) { pwError = 'New password is required.'; return; }
    if (newPassword.length < 8) { pwError = 'New password must be at least 8 characters.'; return; }
    if (newPassword !== confirmPassword) { pwError = 'Passwords do not match.'; return; }

    if (isDemo) {
      if (session) { session = { ...session, pendingPasswordChange: false }; storeSession(session); }
      pwToast = 'demo';
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
      return;
    }

    pwLoading = true;
    try {
      await changePassword(currentPassword, newPassword);
      clearSession();
      goto('/login?reason=password_changed');
    } catch (err: unknown) {
      pwError = err instanceof Error ? err.message : 'Failed to change password.';
    } finally {
      pwLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Profile — Setara</title>
</svelte:head>

<div class="page">
  <div class="page-header">
    <h1 class="page-title">Profile</h1>
    <p class="page-subtitle">Manage your account</p>
  </div>

  {#if mustChangePassword || reason === 'set_password'}
    <div class="pending-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>Your account was created with a temporary password. Please change it below before continuing.</span>
    </div>
  {/if}

  {#if session}
    <Card padding="sm">
      <div class="profile-card-content">
        <!-- Avatar -->
        <div class="avatar-section">
          <div class="avatar-large">
            {session.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div class="avatar-info">
            <span class="avatar-name">{session.name}</span>
            <span class="avatar-email">{session.email}</span>
            <span class="avatar-role">{session.role}</span>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Account info -->
        <div class="form-section">
          <div class="form-group">
            <label class="form-label" for="email">Email</label>
            <input
              id="email"
              class="form-input form-input--readonly"
              type="email"
              value={session.email}
              readonly
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="role">Role</label>
            <input
              id="role"
              class="form-input form-input--readonly"
              type="text"
              value={session.role}
              readonly
            />
          </div>
        </div>

        <div class="divider"></div>

        <!-- Change password -->
        <div class="form-section">
          <div class="section-title">Change password</div>

          {#if pwToast === 'demo'}
            <div class="toast toast--info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span><strong>Demo mode</strong> — password changes are not saved.</span>
            </div>
          {/if}

          {#if pwError}
            <div class="toast toast--error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {pwError}
            </div>
          {/if}

          <div class="form-group">
            <label class="form-label" for="current-password">Current password</label>
            <input
              id="current-password"
              class="form-input"
              type="password"
              bind:value={currentPassword}
              autocomplete="current-password"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="new-password">New password</label>
            <input
              id="new-password"
              class="form-input"
              type="password"
              bind:value={newPassword}
              autocomplete="new-password"
            />
            <span class="form-hint">At least 8 characters.</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              class="form-input"
              type="password"
              bind:value={confirmPassword}
              autocomplete="new-password"
            />
          </div>

          <div class="form-actions">
            <Button variant="primary" onclick={handleChangePassword} disabled={pwLoading}>
              {pwLoading ? 'Changing…' : 'Change password'}
            </Button>
          </div>
        </div>

        <div class="divider"></div>

        <div class="form-section form-section--compact">
          <Button variant="danger" onclick={signOut}>Sign out</Button>
        </div>
      </div>
    </Card>
  {/if}
</div>

<style>
  .page { max-width: 560px; }

  .page-header { margin-bottom: 28px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-subtitle { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }

  .pending-banner {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 12px 16px; border-radius: var(--radius);
    background: color-mix(in srgb, var(--color-warning, #f59e0b), transparent 88%);
    color: color-mix(in srgb, var(--color-warning, #f59e0b), #000 30%);
    border: 1px solid color-mix(in srgb, var(--color-warning, #f59e0b), transparent 60%);
    font-size: 0.875rem; margin-bottom: 16px;
  }
  .pending-banner svg { flex-shrink: 0; margin-top: 1px; }

  .profile-card-content { overflow: hidden; }

  .avatar-section {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 28px 28px 24px;
  }

  .avatar-large {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--color-accent);
    color: #fff;
    font-weight: 700;
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .avatar-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .avatar-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .avatar-email {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .avatar-role {
    width: fit-content;
    border-radius: 999px;
    background: var(--color-accent-subtle);
    color: var(--color-accent);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 3px 7px;
  }

  .divider { height: 1px; background: var(--color-border); }

  .form-section {
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-section--compact { padding: 20px 28px; }

  .section-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .form-input {
    padding: 9px 12px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.9rem;
    font-family: inherit;
    transition: border-color 0.15s;
    outline: none;
  }

  .form-input:focus {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12);
  }

  .form-input--readonly {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .form-hint {
    font-size: 0.76rem;
    color: var(--color-text-muted);
    opacity: 0.75;
  }

  .form-actions {
    padding-top: 4px;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 500;
  }

  .toast--info {
    background: color-mix(in srgb, var(--color-accent), transparent 88%);
    color: var(--color-accent);
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 70%);
  }

  .toast--error {
    background: rgba(239, 68, 68, 0.08);
    color: var(--color-danger);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .toast strong { font-weight: 700; }
</style>
