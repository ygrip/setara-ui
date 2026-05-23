<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let session = $state<{ email: string; name: string } | null>(null);
  let editName = $state('');
  let saved = $state(false);

  onMount(() => {
    const raw = localStorage.getItem('setara_session');
    if (!raw) { goto('/login'); return; }
    try {
      session = JSON.parse(raw);
      editName = session?.name ?? '';
    } catch {
      goto('/login');
    }
  });

  function saveChanges() {
    if (!session) return;
    session = { ...session, name: editName };
    localStorage.setItem('setara_session', JSON.stringify(session));
    saved = true;
    setTimeout(() => { saved = false; }, 2000);
  }

  function signOut() {
    localStorage.removeItem('setara_session');
    goto('/login');
  }
</script>

<svelte:head>
  <title>Profile — Setara</title>
</svelte:head>

<div class="page">
  <div class="page-header">
    <h1 class="page-title">Profile</h1>
    <p class="page-subtitle">Manage your account details</p>
  </div>

  {#if session}
    <div class="profile-card">
      <!-- Avatar -->
      <div class="avatar-section">
        <div class="avatar-large">
          {session.name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div class="avatar-info">
          <span class="avatar-name">{session.name}</span>
          <span class="avatar-email">{session.email}</span>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Edit form -->
      <div class="form-section">
        <div class="form-group">
          <label class="form-label" for="display-name">Display name</label>
          <input
            id="display-name"
            class="form-input"
            type="text"
            bind:value={editName}
            placeholder="Your name"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="email">Email</label>
          <input
            id="email"
            class="form-input form-input--readonly"
            type="email"
            value={session.email}
            readonly
          />
          <span class="form-hint">Email cannot be changed here.</span>
        </div>

        <div class="form-actions">
          <button class="btn btn--primary" onclick={saveChanges}>
            {saved ? 'Saved!' : 'Save changes'}
          </button>
          <button class="btn btn--danger" onclick={signOut}>Sign out</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .page { max-width: 560px; }

  .page-header { margin-bottom: 28px; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
  .page-subtitle { color: var(--color-text-muted); margin: 0; font-size: 0.875rem; }

  .profile-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }

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

  .divider {
    height: 1px;
    background: var(--color-border);
  }

  .form-section {
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
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
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 4px;
  }

  .btn {
    padding: 8px 18px;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background 0.15s, opacity 0.15s;
  }

  .btn--primary {
    background: var(--color-accent);
    color: #fff;
  }

  .btn--primary:hover {
    background: var(--color-accent-hover);
  }

  .btn--danger {
    background: none;
    border: 1px solid var(--color-danger);
    color: var(--color-danger);
  }

  .btn--danger:hover {
    background: rgba(220, 38, 38, 0.08);
  }
</style>
