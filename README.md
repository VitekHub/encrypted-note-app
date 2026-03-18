# CipherNote

A zero-knowledge encrypted notepad. Your note is encrypted client-side before being stored - the server never sees your plaintext.

## How it works

- **Argon2id** derives a password-based key used to protect an **RSA-4096** private key
- An **AES-GCM master key** is wrapped with your RSA public key and stored server-side
- Notes are encrypted with a field key derived from the master key
- The master key only ever lives in memory - it is cleared on lock or logout

## Features

- Account-based with Supabase backend (no plaintext data ever sent)
- Auto-lock on inactivity
- Argon2id parameter calibration per device
- RSA key rotation
- Login lockout against brute-force
- Password change with full key re-wrapping

## Tech Stack

- [Vue 3](https://vuejs.org/) + TypeScript + Pinia
- [Vite](https://vitejs.dev/) + Tailwind CSS v4
- Web Crypto API (RSA-4096, AES-GCM)
- [hash-wasm](https://github.com/nicktindall/hash-wasm) for Argon2id
- [Supabase](https://supabase.com/) for auth and encrypted data storage

## Getting Started

```bash
npm install
npm run dev
```

## Running Tests

```bash
npm test
```

## License

MIT - see [LICENSE](LICENSE)
