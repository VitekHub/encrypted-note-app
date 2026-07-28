# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CipherNote — a zero-knowledge encrypted notepad. Notes are encrypted client-side before storage; the server (Supabase) never sees plaintext.

## Tech Stack

- **Vue 3** + **TypeScript** + **Pinia** (composition-API stores)
- **Vite** (dev/build) + **Tailwind CSS v4** (styling via `@tailwindcss/vite` plugin)
- **Web Crypto API** (RSA-4096, AES-GCM) for all cryptographic operations
- **hash-wasm** for Argon2id (WASM-based, runs in browser; used for key derivation, not auth)
- **secure-remote-password** for SRP-6a authentication protocol
- **Supabase** (`@supabase/supabase-js`) for auth and encrypted data storage
- **vue-router** v5 for routing
- **marked** for Markdown rendering, **dompurify** for sanitization
- **idb** for IndexedDB access
- **js-base64** for base64 encoding
- **ESLint** + **Prettier** for linting/formatting
- **Vitest** for testing (node environment, v8 coverage)

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Type-check (vue-tsc) then build for production
npm test             # Run all tests once (vitest)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run lint         # Lint with ESLint
npm run lint:fix     # Auto-fix lint issues
npm run format       # Format with Prettier
npm run format:check # Check formatting
```

Run a single test file: `npx vitest run src/stores/authStore.test.ts`

## Architecture

### Crypto Key Hierarchy

The entire security model depends on this chain:

```
Password ──Argon2id──► password-derived key (encrypts RSA private key)
                          │
RSA-4096 key pair ──────► wraps/unwraps AES-GCM master key
                              │
AES-GCM master key ──HKDF──► per-field keys (e.g. "note" field key)
```

- The master key only exists in memory — never persisted. Cleared on lock/logout.
- Password is never sent to Supabase. Auth uses SRP-6a (Secure Remote Password) via Edge Functions — only a verifier and zero-knowledge proofs are transmitted, never the password or its hashes.
- Argon2id parameters are calibrated per-device at signup (3-phase algorithm in `argon2CalibrationService`).
- `Encryptor` (in `utils/crypto/`) handles low-level AES-GCM encrypt/decrypt with base64 blob format: `salt || [metadata] || iv || ciphertext`.

### Supabase Integration

- Auth: uses SRP-6a protocol via Edge Functions (`srp-register`, `srp-login-init`, `srp-login-verify`, `srp-change-password`). Synthetic emails (`username@ciphernote.local`) are still created for Supabase Auth, but the password is never known to the client — only a session token obtained via the SRP handshake is used.
- Four tables: `user_keys` (RSA keys, wrapped master key), `user_data` (encrypted key-value pairs keyed by `data_key`), `srp_credentials` (salt, verifier, SRP group per user), `srp_sessions` (ephemeral handshake state, auto-expiring).
- Shared Edge Function helpers in `supabase/functions/_shared/` (`srp.ts`, `http.ts`, `body.ts`, `supabase.ts`).
- Session persistence is disabled (`persistSession: false`) — auth tokens never touch localStorage.
- Row-level security and RPC functions (`check_username_available`, `delete_own_account`) are used server-side.

### Stores (Pinia)

All stores are composition-API style (`defineStore` with setup function):

- **authStore** — session lifecycle: signup, unlock, lock, logout, password change, account teardown. Holds `masterKey` (CryptoKey) in memory.
- **noteStore** — encrypt/decrypt/load/save note via `cryptoService`. Depends on `authStore.masterKey`.
- **settingsStore** — persists idle timeout and Argon2 params as encrypted JSON in `user_data`.
- **notificationStore** — toast-style notifications.
- **themeStore** — dark/light theme toggle.

### Routing & Auth Guards

`router/index.ts` has a `beforeEach` guard:
- Authenticated users on `/login` or `/unlock` are redirected to `/`.
- Unauthenticated users on protected routes (`/`, `/settings`) are redirected to `/login` or `/unlock` depending on whether a Supabase session exists.

### Auto-Lock

`useAutoLock` composable locks the session after configurable idle minutes. Also locks immediately on tab hidden (`visibilitychange`) and `beforeunload`.

## Testing

Tests use Vitest with `environment: 'node'` and 10s timeout. Web Crypto API calls require a Node.js version that supports `crypto.subtle` (Node 19+). Tests mock Supabase and external dependencies; see `src/utils/supabase/supabaseMock.ts`.

## Build & Deploy

Production build sets `base: '/encrypted-note-app/'` for GitHub Pages deployment. Dev uses `/`.