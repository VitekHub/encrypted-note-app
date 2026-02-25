# CipherNote

A private, zero-knowledge notepad that runs entirely in the browser.

## Features

- **AES-256-GCM encryption** — your note is encrypted client-side before anything is stored; the plaintext never leaves your device
- **HaveIBeenPwned check** — passwords are screened against the HIBP breach database using the k-anonymity model (only the first 5 characters of a SHA-1 hash are sent; your actual password is never transmitted)
- **localStorage only** — no server, no accounts, no tracking in this alpha version

## Tech Stack

- [Vue 3](https://vuejs.org/) + TypeScript
- [Vite](https://vitejs.dev/)
- Web Crypto API (native browser encryption)

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

MIT — see [LICENSE](LICENSE)
