# Crypto Core Refactor: Replace Custom Crypto Layer with libsodium

## Overview

The current cryptography layer is built almost entirely from scratch on top of the Web Crypto API and
hash-wasm. While it is functionally correct, it is a large surface area of custom code where any subtle
bug — IV reuse, incorrect AAD, malformed blob parsing — is a silent security vulnerability with no
external audit backing it.

This document is a concrete plan to replace the crypto core with
[libsodium.js](https://github.com/jedisct1/libsodium.js), a JavaScript/WebAssembly port of the
widely audited libsodium C library. libsodium is used by Signal, WireGuard tooling, Cloudflare, and
hundreds of other production systems.

No migration of existing encrypted data is needed. No changes to Supabase tables, RLS policies, the
auth flow, or any UI components are required. The refactor is purely internal to the crypto layer.

---

## What Changes and What Stays the Same

### Unchanged

- Supabase tables (`user_keys`, `user_data`, `profiles`)
- Auth flow (`usernameAuthService.ts`, `authStore.ts`)
- All Pinia stores (except `settingsStore` — see Argon2 params below)
- All Vue components, pages, composables
- The `CryptoService` public interface (`types.ts`)
- The `FieldKeyService` public interface (`types.ts`)
- Router, notification system, auto-lock
- Tests that mock the CryptoService interface

### Replaced

| Current File                                               | What Replaces It                                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `Encryptor.ts`                                             | `libsodium crypto_aead_xchacha20poly1305_ietf_*`                                 |
| `keys/symmetric/passwordDerived/passwordDerivedService.ts` | `libsodium crypto_pwhash` (Argon2id built-in)                                    |
| `keys/symmetric/master/masterKeyService.ts`                | `libsodium crypto_box` (X25519 + XSalsa20-Poly1305)                              |
| `keys/symmetric/field/fieldKeyService.ts`                  | `libsodium crypto_kdf_derive_from_key`                                           |
| `keys/asymmetric/rsa/rsaKeyService.ts`                     | `libsodium crypto_box_keypair` (X25519 replaces RSA-4096)                        |
| `argon2Calibration/argon2CalibrationService.ts`            | libsodium's `crypto_pwhash` uses Argon2id natively; calibration logic simplified |
| `hash-wasm` npm dependency                                 | Removed entirely                                                                 |

---

## Why libsodium?

### Primitive Mapping

| Current Primitive                   | libsodium Equivalent                | Notes                                                      |
| ----------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| AES-256-GCM (field data)            | XChaCha20-Poly1305                  | Faster in software; 192-bit nonce eliminates IV-reuse risk |
| AES-256-GCM (private key wrapper)   | XChaCha20-Poly1305                  | Same                                                       |
| RSA-OAEP-4096 (master key wrapping) | X25519 + `crypto_box`               | 32-byte keys vs 512-byte RSA keys; equivalent security     |
| HKDF-SHA256 (field key derivation)  | `crypto_kdf_derive_from_key`        | libsodium's built-in KDF                                   |
| Argon2id (via hash-wasm)            | `crypto_pwhash` (libsodium native)  | Same algorithm, same parameters; built into libsodium      |
| Manual blob serialization           | libsodium handles nonces internally | Nonce prepended automatically                              |

### Why XChaCha20-Poly1305 over AES-256-GCM

AES-GCM with a 96-bit IV is dangerous if IVs are ever reused — two ciphertexts encrypted with the same
key and IV fully reveal the XOR of both plaintexts and allow the authentication tag to be forged.
XChaCha20-Poly1305 uses a 192-bit nonce, which makes random nonce generation safe for very high message
volumes with negligible collision probability. libsodium's `crypto_secretbox` and
`crypto_aead_xchacha20poly1305_ietf` handle nonce generation and prepending automatically.

### Why X25519 over RSA-4096

RSA-4096 key generation is slow (the current code has timeouts and fallbacks to RSA-3072 and RSA-2048).
X25519 key generation is instantaneous. X25519 provides ~128-bit security, equivalent to RSA-3072.
libsodium's `crypto_box` uses X25519 for key agreement and XSalsa20-Poly1305 for encryption, which is
a well-understood, audited combination.

The master key is currently "wrapped" by RSA-OAEP: the master key is encrypted with the RSA public key
and can only be decrypted with the RSA private key. With X25519, the equivalent operation uses
`crypto_box_seal` (anonymous sender box): the master key bytes are sealed with the X25519 public key
and can only be opened with the corresponding X25519 secret key.

---

## New Key Hierarchy

```
password (user input)
  │
  ├─→ SHA-256(username:password) ─────────────────→ Supabase Auth token (unchanged)
  │
  └─→ libsodium crypto_pwhash (Argon2id)
       │  inputs: password, salt, ops_limit, mem_limit
       │  output: 32 bytes
       │
       └─→ XChaCha20-Poly1305 decrypt
              │  ciphertext: encrypted X25519 secret key (stored in user_keys)
              │
              └─→ X25519 secret key
                     │
                     └─→ crypto_box_seal_open(wrapped_master_key, x25519_pk, x25519_sk)
                            │
                            └─→ master key (32 raw bytes)
                                   │
                                   └─→ crypto_kdf_derive_from_key(master_key, field_id, context)
                                          │
                                          └─→ field key (32 bytes)
                                                 │
                                                 └─→ XChaCha20-Poly1305 encrypt/decrypt field data
```

---

## Argon2 Parameters: Continuity

libsodium's `crypto_pwhash` is Argon2id and accepts the same parameters as hash-wasm:

- `opslimit` = iterations
- `memlimit` = memorySize (in bytes; current code uses KiB, multiply by 1024)
- Output length = 32 bytes (unchanged)

The existing `Argon2Params` type and calibration logic can be kept with minimal changes. libsodium
exposes `crypto_pwhash_OPSLIMIT_INTERACTIVE`, `MODERATE`, and `SENSITIVE` constants as baselines, but
the custom calibration is still valuable for device-adaptive tuning and should be retained.

The only change is the calibration function calls `libsodium.crypto_pwhash(...)` instead of
`hash-wasm.argon2id(...)`.

---

## Supabase Column Remapping

The `user_keys` table currently stores RSA-specific columns. The columns are reused with new semantics;
no schema migration is needed:

| Column                      | Old Content                                                     | New Content                                                          |
| --------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| `rsa_public_key_spki`       | RSA-4096 public key (SPKI, base64)                              | X25519 public key (32 bytes, base64)                                 |
| `rsa_private_key_encrypted` | RSA private key encrypted with Argon2id-derived AES-256-GCM key | X25519 secret key encrypted with Argon2id-derived XChaCha20-Poly1305 |
| `wrapped_master_key`        | Master key RSA-OAEP wrapped with RSA public key                 | Master key sealed with `crypto_box_seal` using X25519 public key     |
| `rsa_key_version`           | `"rsa_v1"`                                                      | `"x25519_v1"` (bump version to detect format on read)                |

The version field (`rsa_key_version`) already exists for this purpose. Reading `"x25519_v1"` in the
version field tells the app to use the new decryption path.

---

## Blob Format Changes

### Old Field Encryption Blob

```
[ salt (16 bytes) | iv (12 bytes) | ciphertext (N bytes) ]  → base64
```

### New Field Encryption Blob

libsodium's `crypto_secretbox_easy` prepends the nonce automatically and
`crypto_aead_xchacha20poly1305_ietf_encrypt` does the same. The output is:

```
[ nonce (24 bytes) | ciphertext+mac (N+16 bytes) ]  → base64
```

No manual salt or IV management is needed. The salt used for field key derivation via
`crypto_kdf_derive_from_key` is replaced by the subkey index (an integer), eliminating the need to
store per-field salts.

### Old Password-Derived Blob (for encrypting X25519 secret key)

```
[ salt (16 bytes) | metadata (16 bytes: Argon2 params) | iv (12 bytes) | ciphertext ]  → base64
```

### New Password-Derived Blob

```
[ salt (16 bytes) | metadata (16 bytes: Argon2 params) | nonce (24 bytes) | ciphertext+mac ]  → base64
```

The metadata block (4 × Uint32: iterations, memorySize, parallelism, hashLength) is preserved
unchanged so Argon2 parameters can be recovered from the blob without querying settings. Only the IV
field grows from 12 to 24 bytes (XChaCha20 nonce).

---

## File-by-File Refactor Plan

### Step 1 — Install libsodium

```
npm install libsodium-wrappers
npm install --save-dev @types/libsodium-wrappers
```

Remove `hash-wasm` from dependencies after all callers are migrated.

All libsodium modules must be initialized before use:

```typescript
import sodium from 'libsodium-wrappers'
await sodium.ready
```

This is a one-time async initialization. It should be called once at app startup (in `main.ts` or as
part of a lazy singleton in a shared `sodium.ts` helper module) and awaited before any crypto
operation runs.

---

### Step 2 — Create `src/utils/crypto/sodiumInstance.ts`

A shared module that initializes libsodium once and exports the ready instance. All other crypto
files import from here instead of importing libsodium directly.

```typescript
import sodium from 'libsodium-wrappers'

let initialized = false

export async function getSodium() {
  if (!initialized) {
    await sodium.ready
    initialized = true
  }
  return sodium
}
```

---

### Step 3 — Refactor `Encryptor.ts` → `src/utils/crypto/sodiumEncryptor.ts`

Replace raw Web Crypto AES-GCM calls with libsodium XChaCha20-Poly1305.

New API (same shape as current `Encryptor` to minimize call-site changes):

```typescript
export class SodiumEncryptor {
  async encrypt(plaintext: string, key: Uint8Array, aad?: Uint8Array): Promise<string>
  async decrypt(blob: string, key: Uint8Array, aad?: Uint8Array): Promise<string>
  isEncrypted(value: string): boolean
}
```

Internally uses `crypto_aead_xchacha20poly1305_ietf_encrypt` with a random 24-byte nonce.
Blob format: `nonce (24) || ciphertext+mac`. All bytes base64-encoded.

The `salt` parameter is removed from `encrypt` — callers that needed salt for HKDF derivation will
now use `crypto_kdf_derive_from_key` instead (see Step 5).

---

### Step 4 — Refactor `passwordDerivedService.ts`

Replace `hash-wasm.argon2id()` + `crypto.subtle.importKey()` + `Encryptor` with:

- `sodium.crypto_pwhash()` for Argon2id derivation (produces raw 32-byte key)
- `SodiumEncryptor` for encrypting/decrypting the X25519 secret key blob

The `Argon2Params` type is unchanged. The blob metadata format (16-byte param block) is unchanged.
Only the internal derivation call changes:

```typescript
// Old (hash-wasm)
const hex = await argon2id({ password, salt, iterations, memorySize, parallelism, hashLength })
const keyBytes = hexToUint8Array(hex)

// New (libsodium)
const sodium = await getSodium()
const keyBytes = sodium.crypto_pwhash(
  32,
  passwordBytes,
  salt,
  iterations, // opslimit
  memorySize * 1024, // memlimit in bytes (current code uses KiB)
  sodium.crypto_pwhash_ALG_ARGON2ID13
)
```

---

### Step 5 — Refactor `rsaKeyService.ts` → `x25519KeyService.ts`

Replace RSA-4096 (Web Crypto) with X25519 (libsodium).

**Key generation:**

```typescript
const keyPair = sodium.crypto_box_keypair()
// keyPair.publicKey: Uint8Array (32 bytes)
// keyPair.privateKey: Uint8Array (32 bytes)
```

**Store keys:**

- Encrypt secret key: `passwordDerivedService.encrypt(secretKeyBase64, password, 'x25519_secret_key_v1')`
- Store public key as base64 in `rsa_public_key_spki` column
- Store encrypted secret key in `rsa_private_key_encrypted` column
- Write `"x25519_v1"` to `rsa_key_version`

**Load keys:**

- Decrypt secret key: `passwordDerivedService.decrypt(encryptedBlob, password, 'x25519_secret_key_v1')`
- Both public and secret keys are just raw 32-byte arrays — no import step needed

**Key rotation** is dramatically simpler: generate new keypair, re-seal master key with new public key,
store. No timeouts, no fallback sizes, no PKCS8/SPKI export.

This file should be renamed to `x25519KeyService.ts` with a corresponding `index.ts` and `types.ts`.
The old `rsa/` directory can be deleted.

---

### Step 6 — Refactor `masterKeyService.ts`

Replace RSA-OAEP wrapping with `crypto_box_seal` / `crypto_box_seal_open`.

**Generate master key:**

```typescript
const masterKey = sodium.randombytes_buf(32) // 32 random bytes
```

**Wrap (seal) master key with X25519 public key:**

```typescript
const sealed = sodium.crypto_box_seal(masterKey, x25519PublicKey)
// sealed: 48 bytes (32-byte overhead + 32-byte message)
```

**Unwrap (open) master key with X25519 secret key:**

```typescript
const masterKey = sodium.crypto_box_seal_open(sealedBlob, x25519PublicKey, x25519SecretKey)
```

No concept of "wrapping" or `wrapKey` / `unwrapKey` via Web Crypto is needed. The master key is simply
raw bytes; it is never a `CryptoKey` object.

The `convertToDerivable` step (converting extractable AES key to non-extractable HKDF key) is
eliminated entirely — the master key is just a `Uint8Array` used directly with `crypto_kdf_derive_from_key`.

---

### Step 7 — Refactor `fieldKeyService.ts`

Replace HKDF-SHA256 (Web Crypto) with `crypto_kdf_derive_from_key` (libsodium).

```typescript
// libsodium KDF requires:
// - master key: 32 bytes
// - subkey_id: uint64 (use a numeric hash of fieldId)
// - context: 8 bytes (use e.g. "FIELDKEY")
// - subkey_len: 32

const fieldKey = sodium.crypto_kdf_derive_from_key(
  32, // subkey length
  fieldIndex, // numeric index derived from fieldId
  'FIELDKEY', // 8-byte context string
  masterKey // 32-byte master key
)
```

The in-memory cache (`Map<fieldId, {key, salt}>`) becomes `Map<fieldId, Uint8Array>` — just the
derived key bytes, no salt needed since derivation is deterministic from master key + fieldId alone.

Field encryption uses `SodiumEncryptor.encrypt(plaintext, fieldKey, aad)`.

---

### Step 8 — Refactor `argon2CalibrationService.ts`

Replace `hash-wasm.argon2id()` benchmark calls with `sodium.crypto_pwhash()` calls using the same
parameter set. The three-phase calibration algorithm (exponential search → binary search → iteration
tuning) is unchanged. Only the inner timing call changes:

```typescript
// Old
const start = performance.now()
await argon2id({ password: testPassword, salt: testSalt, ...params })
const duration = performance.now() - start

// New
const start = performance.now()
sodium.crypto_pwhash(
  32,
  testPassword,
  testSalt,
  params.iterations,
  params.memorySize * 1024,
  sodium.crypto_pwhash_ALG_ARGON2ID13
)
const duration = performance.now() - start
```

Note: libsodium's `crypto_pwhash` is synchronous (blocking). The calibration loop wraps each call in
a `setTimeout` / `Promise` to yield to the event loop between iterations, same as today.

---

### Step 9 — Update `cryptoServiceImpl.ts`

The `CryptoService` public interface (`types.ts`) does not change. Only the internal wiring changes:

- `setup()`: calls `x25519KeyService.generateKeys()` instead of `rsaKeyService.generateKeys()`; seals
  master key bytes with `crypto_box_seal` instead of `wrapKey`
- `unlock()`: loads X25519 secret key, opens master key with `crypto_box_seal_open`
- `encrypt()` / `decrypt()`: master key is now `Uint8Array` instead of `CryptoKey`; pass through to
  `fieldKeyService`
- `rotateRsaKeys()`: rename to `rotateKeys()`; internally generates new X25519 keypair
- `lock()`: clears field key cache (unchanged in behavior)

The AAD string `v1:${userId}:${fieldId}` is retained unchanged.

---

### Step 10 — Update `authStore.ts`

The `masterKey` state field changes type from `CryptoKey | null` to `Uint8Array | null`. All places
that pass `masterKey` to `cryptoService.encrypt()` / `decrypt()` work unchanged since those are
opaque from the store's perspective. The `isAuthenticated` computed property check `masterKey !== null`
is unchanged.

---

### Step 11 — Remove `hash-wasm`

After all callers are migrated, remove `hash-wasm` from `package.json`:

```
npm uninstall hash-wasm
```

---

## Files to Delete After Refactor

- `src/utils/crypto/keys/asymmetric/rsa/rsaKeyService.ts`
- `src/utils/crypto/keys/asymmetric/rsa/rsaKeyService.test.ts`
- `src/utils/crypto/keys/asymmetric/rsa/types.ts`
- `src/utils/crypto/keys/asymmetric/rsa/index.ts`
- `src/utils/crypto/keys/asymmetric/` (directory, if empty)
- `src/utils/crypto/Encryptor.ts`
- `src/utils/crypto/Encryptor.test.ts`

---

## New Files Created

- `src/utils/crypto/sodiumInstance.ts` — libsodium singleton initializer
- `src/utils/crypto/sodiumEncryptor.ts` — XChaCha20-Poly1305 encrypt/decrypt
- `src/utils/crypto/sodiumEncryptor.test.ts`
- `src/utils/crypto/keys/asymmetric/x25519/x25519KeyService.ts`
- `src/utils/crypto/keys/asymmetric/x25519/x25519KeyService.test.ts`
- `src/utils/crypto/keys/asymmetric/x25519/types.ts`
- `src/utils/crypto/keys/asymmetric/x25519/index.ts`

---

## Estimated Code Reduction

| Area                          | Current Lines | Estimated After            |
| ----------------------------- | ------------- | -------------------------- |
| `Encryptor.ts`                | ~100          | ~50 (sodiumEncryptor)      |
| `passwordDerivedService.ts`   | ~120          | ~70                        |
| `rsaKeyService.ts`            | ~200          | ~80 (x25519KeyService)     |
| `masterKeyService.ts`         | ~100          | ~40                        |
| `fieldKeyService.ts`          | ~100          | ~60                        |
| `argon2CalibrationService.ts` | ~130          | ~110 (algorithm unchanged) |
| `cryptoServiceImpl.ts`        | ~130          | ~100                       |
| **Total**                     | **~780**      | **~510**                   |

Reduction of approximately 270 lines (~35%), plus elimination of `hash-wasm` and all `crypto.subtle`
direct calls throughout the layer.

---

## Security Improvements

| Before                                                                             | After                                                                                |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| RSA-4096 key generation: slow, JS timeout fallback, possible downgrade to 2048-bit | X25519 key generation: instantaneous, no fallback needed                             |
| AES-GCM with 96-bit random IV: non-negligible collision risk at scale              | XChaCha20-Poly1305 with 192-bit nonce: collision-safe for random nonce generation    |
| Custom blob serialization: hand-rolled salt\|\|metadata\|\|iv\|\|ciphertext parser | libsodium handles nonce internally; less manual byte manipulation                    |
| HKDF implemented via raw `crypto.subtle.deriveKey`: correct but unaudited wiring   | `crypto_kdf_derive_from_key`: dedicated KDF function with domain separation built in |
| hash-wasm Argon2id: community port, no formal audit                                | libsodium Argon2id: reference implementation, formally audited                       |

---

## Risks and Mitigations

**Risk:** libsodium WASM initialization is async — must be awaited before any crypto call.
**Mitigation:** `sodiumInstance.ts` singleton ensures it is initialized once. All crypto service methods
are already `async`; no interface changes needed.

**Risk:** `crypto_kdf_derive_from_key` requires a numeric `subkey_id`, but current code uses string
`fieldId` values like `"note"`.
**Mitigation:** Convert `fieldId` to a stable numeric index. Maintain a mapping constant:

```typescript
const FIELD_IDS = { note: 1 } as const
```

New field types get the next integer. This mapping must be treated as permanent — changing it would
invalidate existing ciphertext.

**Risk:** `crypto_box_seal` is a one-way seal (anonymous sender). Key rotation requires re-opening
the sealed master key with the old X25519 secret key and re-sealing with the new public key.
**Mitigation:** This is already how `rotateRsaKeys` works today — the same pattern applies.

**Risk:** libsodium WASM bundle size (~300 KB gzipped).
**Mitigation:** Use dynamic import (`import('libsodium-wrappers')`) to load lazily on first crypto
operation. The app already has a loading state during Argon2 calibration/unlock; WASM load can be
absorbed into that same gate.

---

## Implementation Order

1. Install libsodium, create `sodiumInstance.ts`
2. Write `sodiumEncryptor.ts` with tests
3. Refactor `passwordDerivedService.ts` (uses encryptor + Argon2)
4. Refactor `argon2CalibrationService.ts` (uses Argon2 only)
5. Write `x25519KeyService.ts` (uses passwordDerivedService)
6. Refactor `masterKeyService.ts` (uses x25519 keypair)
7. Refactor `fieldKeyService.ts` (uses master key)
8. Update `cryptoServiceImpl.ts` (orchestrates all of the above)
9. Update `authStore.ts` (masterKey type change)
10. Delete old RSA files and `Encryptor.ts`
11. Uninstall `hash-wasm`
12. Run full test suite; update any test fixtures that contain old blob formats
