<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import BentoCard from '$lib/components/BentoCard.svelte';
  import { clearSession, getValidSession, storeSession, type SetaraSession } from '$lib/auth';
  import { changePassword, getMe, updateDisplayName } from '$lib/api/client';
  import { isMockMode } from '$lib/mock/client';

  let session = $state<SetaraSession | null>(null);
  let memberSince = $state('');
  const isDemo = isMockMode();
  const mustChangePassword = $derived(!!session?.pendingPasswordChange);
  const reason = $derived(browser ? page.url.searchParams.get('reason') : null);

  // Display name editing
  let editingName = $state(false);
  let displayNameDraft = $state('');
  let nameLoading = $state(false);
  let nameError = $state('');

  // Change password form
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let showCurrent = $state(false);
  let showNew = $state(false);
  let showConfirm = $state(false);
  let pwLoading = $state(false);
  let pwError = $state('');
  let pwToast = $state('');

  const pwChecks = $derived([
    { label: 'At least 8 characters', ok: newPassword.length >= 8 },
    { label: 'Contains uppercase letter', ok: /[A-Z]/.test(newPassword) },
    { label: 'Contains number', ok: /[0-9]/.test(newPassword) },
    { label: 'Contains special character', ok: /[^A-Za-z0-9]/.test(newPassword) }
  ]);
  const pwScore = $derived(newPassword ? pwChecks.filter((c) => c.ok).length : 0);
  const pwStrengthLabel = $derived(
    !newPassword ? '' : ['Weak', 'Weak', 'Fair', 'Good', 'Strong'][pwScore]
  );
  const pwStrengthVariant = $derived(
    ['danger', 'danger', 'warning', 'info', 'success'][pwScore] as
      | 'danger'
      | 'warning'
      | 'info'
      | 'success'
  );

  const accountStats = $derived.by(() => {
    const stats: { icon: 'calendar' | 'clock' | 'map' | 'shield'; label: string; value: string }[] = [];
    if (memberSince) {
      stats.push({
        icon: 'calendar',
        label: 'Member since',
        value: new Date(memberSince).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      });
    }
    if (isDemo) {
      stats.push({
        icon: 'clock',
        label: 'Last sign-in',
        value: `Today, ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
      });
      stats.push({ icon: 'map', label: 'Location', value: 'Jakarta, Indonesia' });
    }
    if (session?.expiresAt) {
      stats.push({
        icon: 'shield',
        label: 'Session valid until',
        value: new Date(session.expiresAt).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        })
      });
    }
    return stats;
  });

  onMount(() => {
    session = getValidSession();
    if (!session) { goto('/login'); return; }

    if (isDemo) {
      memberSince = 'May 12, 2024';
    } else {
      getMe().then((me) => { memberSince = me.createdAt; }).catch(() => {});
    }
  });

  function signOut() {
    clearSession();
    goto('/login');
  }

  function startEditName() {
    nameError = '';
    displayNameDraft = session?.name ?? '';
    editingName = true;
  }

  function cancelEditName() {
    editingName = false;
    nameError = '';
  }

  async function saveDisplayName() {
    nameError = '';
    if (!displayNameDraft.trim()) { nameError = 'Display name is required.'; return; }

    if (isDemo) {
      if (session) { session = { ...session, name: displayNameDraft.trim() }; storeSession(session); }
      editingName = false;
      return;
    }

    nameLoading = true;
    try {
      const updated = await updateDisplayName(displayNameDraft.trim());
      if (session) { session = { ...session, name: updated.displayName }; storeSession(session); }
      editingName = false;
    } catch (err: unknown) {
      nameError = err instanceof Error ? err.message : 'Failed to update display name.';
    } finally {
      nameLoading = false;
    }
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
  <title>Profile - Setara</title>
</svelte:head>

{#snippet icon(name: string)}
  {#if name === 'user'}
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  {:else if name === 'lock'}
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  {:else if name === 'calendar'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  {:else if name === 'clock'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  {:else if name === 'map'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
  {:else if name === 'shield'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  {:else if name === 'check'}
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
  {:else if name === 'eye'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  {:else if name === 'eye-off'}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  {:else if name === 'edit'}
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  {:else if name === 'signout'}
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
  {/if}
{/snippet}

<div class="page">
  <div class="page-header">
    <h1 class="page-title">Profile</h1>
    <p class="page-subtitle">Manage your personal information and account security</p>
  </div>

  {#if mustChangePassword || reason === 'set_password'}
    <div class="pending-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>Your account was created with a temporary password. Please change it below before continuing.</span>
    </div>
  {/if}

  {#if session}
    <div class="profile-grid">
      <!-- Account summary -->
      <BentoCard title="Account summary" padding="lg" className="summary-card">
        <div class="avatar-row">
          <div class="avatar-wrap">
            <div class="avatar-large">{session.name?.[0]?.toUpperCase() ?? '?'}</div>
            {#if !mustChangePassword}
              <span class="avatar-check">{@render icon('check')}</span>
            {/if}
          </div>
          <div class="avatar-info">
            <span class="avatar-name">{session.name}</span>
            <span class="avatar-email">{session.email}</span>
            <Badge text={session.role} variant="neutral" />
          </div>
        </div>

        {#if accountStats.length}
          <div class="divider"></div>
          <div class="stat-list">
            {#each accountStats as stat (stat.label)}
              <div class="stat-row">
                <span class="stat-icon">{@render icon(stat.icon)}</span>
                <span class="stat-label">{stat.label}</span>
                <span class="stat-value">{stat.value}</span>
              </div>
            {/each}
            <div class="stat-row">
              <span class="stat-icon">{@render icon('shield')}</span>
              <span class="stat-label">Account status</span>
              <Badge
                text={mustChangePassword ? 'Password change required' : 'Active'}
                variant={mustChangePassword ? 'warning' : 'success'}
              />
            </div>
          </div>
        {/if}

        <div class="security-tip">
          <span class="security-tip__icon">{@render icon('shield')}</span>
          <div class="security-tip__body">
            <strong>Security tip</strong>
            <p>Use a strong, unique password and avoid reusing it across different websites.</p>
          </div>
        </div>
      </BentoCard>

      <div class="right-column">
        <!-- Profile information -->
        <BentoCard
          title="Profile information"
          subtitle="Your personal details and preferences."
        >
          {#snippet headerActions()}
            <span class="header-icon">{@render icon('user')}</span>
          {/snippet}
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="display-name">Display name</label>
              {#if editingName}
                <div class="input-with-action">
                  <input
                    id="display-name"
                    class="form-input"
                    type="text"
                    bind:value={displayNameDraft}
                    disabled={nameLoading}
                    maxlength="80"
                  />
                </div>
                {#if nameError}<span class="field-error">{nameError}</span>{/if}
                <div class="name-edit-actions">
                  <Button variant="primary" size="sm" onclick={saveDisplayName} disabled={nameLoading}>
                    {nameLoading ? 'Saving…' : 'Save'}
                  </Button>
                  <Button variant="ghost" size="sm" onclick={cancelEditName} disabled={nameLoading}>Cancel</Button>
                </div>
              {:else}
                <div class="input-with-action">
                  <input id="display-name" class="form-input form-input--readonly" type="text" value={session.name} readonly />
                  <button type="button" class="input-action" onclick={startEditName} aria-label="Edit display name">
                    {@render icon('edit')}
                  </button>
                </div>
              {/if}
            </div>
            <div class="form-group">
              <label class="form-label" for="email">Email address</label>
              <input id="email" class="form-input form-input--readonly" type="email" value={session.email} readonly />
            </div>
            <div class="form-group">
              <label class="form-label" for="role">Role</label>
              <input id="role" class="form-input form-input--readonly" type="text" value={session.role} readonly />
            </div>
          </div>
          <p class="form-note">Your email and role are managed by administrators.</p>
        </BentoCard>

        <!-- Password and security -->
        <BentoCard
          title="Password and security"
          subtitle="Update your password regularly to keep your account secure."
        >
          {#snippet headerActions()}
            <span class="header-icon">{@render icon('lock')}</span>
          {/snippet}

          {#if pwToast === 'demo'}
            <div class="toast toast--info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span><strong>Demo mode</strong> - password changes are not saved.</span>
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

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="current-password">Current password</label>
              <div class="input-with-action">
                <input
                  id="current-password"
                  class="form-input"
                  type={showCurrent ? 'text' : 'password'}
                  bind:value={currentPassword}
                  autocomplete="current-password"
                />
                <button type="button" class="input-action" onclick={() => (showCurrent = !showCurrent)} aria-label={showCurrent ? 'Hide password' : 'Show password'}>
                  {@render icon(showCurrent ? 'eye-off' : 'eye')}
                </button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="new-password">New password</label>
              <div class="input-with-action">
                <input
                  id="new-password"
                  class="form-input"
                  type={showNew ? 'text' : 'password'}
                  bind:value={newPassword}
                  autocomplete="new-password"
                />
                <button type="button" class="input-action" onclick={() => (showNew = !showNew)} aria-label={showNew ? 'Hide password' : 'Show password'}>
                  {@render icon(showNew ? 'eye-off' : 'eye')}
                </button>
              </div>
              {#if newPassword}
                <div class="strength-meter">
                  {#each [0, 1, 2, 3] as segment (segment)}
                    <span class="strength-seg {segment < pwScore ? `filled strength-${pwStrengthVariant}` : ''}"></span>
                  {/each}
                </div>
                <span class="strength-label strength-label--{pwStrengthVariant}">{pwStrengthLabel}</span>
              {/if}
            </div>

            <div class="form-group">
              <label class="form-label" for="confirm-password">Confirm new password</label>
              <div class="input-with-action">
                <input
                  id="confirm-password"
                  class="form-input"
                  type={showConfirm ? 'text' : 'password'}
                  bind:value={confirmPassword}
                  autocomplete="new-password"
                />
                <button type="button" class="input-action" onclick={() => (showConfirm = !showConfirm)} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                  {@render icon(showConfirm ? 'eye-off' : 'eye')}
                </button>
              </div>
            </div>
          </div>

          <ul class="pw-checklist">
            {#each pwChecks as check (check.label)}
              <li class:ok={check.ok}>
                <span class="pw-checklist__icon">{#if check.ok}{@render icon('check')}{/if}</span>
                {check.label}
              </li>
            {/each}
          </ul>

          <div class="form-actions account-action-row">
            <Button variant="primary" onclick={handleChangePassword} disabled={pwLoading}>
              {pwLoading ? 'Updating…' : 'Update password'}
            </Button>
          </div>
        </BentoCard>

        <!-- Account actions -->
        <BentoCard title="Account actions" subtitle="Manage your session and account access.">
          <div class="account-action-row">
            <div class="account-action-info">
              <span class="account-action-icon">{@render icon('signout')}</span>
              <div>
                <strong>Sign out from this browser</strong>
                <p>You will be signed out of your current session.</p>
              </div>
            </div>
            <Button variant="ghost" className="btn--danger" onclick={signOut}>Sign out</Button>
          </div>
        </BentoCard>
      </div>
    </div>
  {/if}
</div>

<style>
  .page { max-width: 100%; min-height: calc(100vh - 80px); }

  .page-header { margin-bottom: 24px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-subtitle { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }

  .pending-banner {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 12px 16px; border-radius: var(--radius);
    background: color-mix(in srgb, var(--color-warning), transparent 88%);
    color: color-mix(in srgb, var(--color-warning), #000 30%);
    border: 1px solid color-mix(in srgb, var(--color-warning), transparent 60%);
    font-size: 0.875rem; margin-bottom: 16px;
  }
  .pending-banner svg { flex-shrink: 0; margin-top: 1px; }

  .profile-grid {
    display: grid;
    grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }

  .right-column { display: grid; gap: 20px; min-width: 0; }

  @media (max-width: 860px) {
    .profile-grid { grid-template-columns: 1fr; }
  }

  .header-icon {
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 50%;
    background: var(--color-accent-subtle); color: var(--color-accent);
    flex-shrink: 0;
  }

  /* ── Account summary ── */
  .avatar-row { display: flex; align-items: center; gap: 16px; }

  .avatar-wrap { position: relative; flex-shrink: 0; }

  .avatar-large {
    width: 60px; height: 60px; border-radius: 50%;
    background: var(--color-accent); color: #fff;
    font-weight: 700; font-size: 1.4rem;
    display: flex; align-items: center; justify-content: center;
  }

  .avatar-check {
    position: absolute; bottom: -2px; right: -2px;
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--color-success); color: #fff;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid var(--color-surface);
  }

  .avatar-info { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .avatar-name { font-size: 1.05rem; font-weight: 700; color: var(--color-text); }
  .avatar-email {
    font-size: 0.82rem; color: var(--color-text-muted);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .divider { height: 1px; background: var(--color-border); margin: 18px 0; }

  .stat-list { display: grid; gap: 12px; margin-bottom: 18px; }

  .stat-row { display: flex; align-items: center; gap: 10px; font-size: 0.84rem; }
  .stat-icon { display: flex; color: var(--color-text-muted); flex-shrink: 0; }
  .stat-label { color: var(--color-text-muted); flex: 1; min-width: 0; }
  .stat-value { font-weight: 600; color: var(--color-text); text-align: right; white-space: nowrap; }

  .security-tip {
    display: flex; gap: 12px;
    padding: 14px 16px; border-radius: var(--radius);
    background: var(--color-accent-subtle);
    border: 1px solid color-mix(in srgb, var(--color-accent), transparent 75%);
  }
  .security-tip__icon {
    display: flex; align-items: center; justify-content: center;
    width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
    background: color-mix(in srgb, var(--color-accent), transparent 80%);
    color: var(--color-accent);
  }
  .security-tip__body strong { font-size: 0.85rem; color: var(--color-text); }
  .security-tip__body p { margin: 3px 0 0; font-size: 0.8rem; color: var(--color-text-muted); line-height: 1.4; }

  /* ── Forms ── */
  .form-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px 20px; margin-bottom: 4px;
  }

  .form-group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }

  .form-label {
    font-size: 0.78rem; font-weight: 600; color: var(--color-text-muted);
    text-transform: uppercase; letter-spacing: 0.05em;
  }

  .form-input {
    padding: 9px 12px; border: 1px solid var(--color-border); border-radius: 8px;
    background: var(--color-bg); color: var(--color-text);
    font-size: 0.9rem; font-family: inherit; width: 100%;
    transition: border-color 0.15s; outline: none;
  }

  .form-input:focus {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px rgba(0, 175, 165, 0.12);
  }

  .form-input--readonly { opacity: 0.6; cursor: not-allowed; }

  .form-note { margin: 10px 0 0; font-size: 0.78rem; color: var(--color-text-muted); }

  .field-error { display: block; margin-top: 5px; font-size: 0.76rem; color: var(--color-danger); }
  .name-edit-actions { display: flex; gap: 8px; margin-top: 8px; }

  .input-with-action { position: relative; }
  .input-with-action .form-input { padding-right: 38px; }
  .input-action {
    position: absolute; top: 50%; right: 6px; transform: translateY(-50%);
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 6px; border: none;
    background: transparent; color: var(--color-text-muted); cursor: pointer;
  }
  .input-action:hover { color: var(--color-accent); background: var(--color-accent-subtle); }

  .strength-meter { display: flex; gap: 4px; margin-top: 6px; }
  .strength-seg { flex: 1; height: 4px; border-radius: 2px; background: var(--color-border); }
  .strength-seg.filled.strength-danger { background: var(--color-danger); }
  .strength-seg.filled.strength-warning { background: var(--color-warning); }
  .strength-seg.filled.strength-info { background: var(--color-info); }
  .strength-seg.filled.strength-success { background: var(--color-success); }

  .strength-label { display: inline-block; margin-top: 4px; font-size: 0.74rem; font-weight: 700; }
  .strength-label--danger { color: var(--color-danger); }
  .strength-label--warning { color: var(--color-warning); }
  .strength-label--info { color: var(--color-info); }
  .strength-label--success { color: var(--color-success); }

  .pw-checklist {
    list-style: none; margin: 14px 0 0; padding: 0;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 8px 16px;
  }
  .pw-checklist li {
    display: flex; align-items: center; gap: 7px;
    font-size: 0.8rem; color: var(--color-text-muted);
  }
  .pw-checklist li.ok { color: var(--color-success); }
  .pw-checklist__icon {
    display: flex; align-items: center; justify-content: center;
    width: 15px; height: 15px; border-radius: 50%; flex-shrink: 0;
    border: 1.5px solid currentColor;
  }
  .pw-checklist li.ok .pw-checklist__icon { border-color: var(--color-success); }

  .form-actions { margin-top: 16px; }

  .toast {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px; border-radius: 8px;
    font-size: 0.82rem; font-weight: 500; margin-bottom: 14px;
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

  /* ── Account actions ── */
  .account-action-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; flex-wrap: wrap;
  }
  .account-action-info { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
  .account-action-icon {
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
    background: rgba(239, 68, 68, 0.1); color: var(--color-danger);
  }
  .account-action-info strong { font-size: 0.88rem; color: var(--color-text); }
  .account-action-info p { margin: 2px 0 0; font-size: 0.8rem; color: var(--color-text-muted); }

  @media (max-width: 480px) {
    .account-action-row { flex-direction: column; align-items: stretch; }
  }
</style>
