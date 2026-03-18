# Zero-Knowledge Authentication: Removing the Password from the Server

## Background: How Authentication Works Today

The current system uses a derived authentication token so the plaintext password never reaches the server:

```
password  →  SHA-256("username:password")  →  auth token  →  Supabase Auth
```

This means the server only ever sees a hash of the password. The password itself is used on the client to:

1. Derive a key via **Argon2id**
2. Decrypt the **RSA private key** stored in `user_keys`
3. Use the RSA private key to unwrap the **master key**
4. Use the master key to derive per-field **AES-GCM keys** via HKDF

The full key chain:

```
password
  ├─→ SHA-256(username:password) ──────────────────────→ Supabase Auth session
  └─→ Argon2id(password, salt)
        └─→ AES-GCM decrypt
              └─→ RSA private key
                    └─→ RSA-OAEP unwrap
                          └─→ master key (AES-GCM 256-bit)
                                └─→ HKDF(master, salt, fieldId)
                                      └─→ field key (AES-GCM 256-bit)
```

## The Problem: SHA-256 Is Not Enough

Although the plaintext password is not sent, SHA-256 is a fast hash — on modern GPUs, billions of SHA-256 hashes per second are possible. If the database were ever compromised, an attacker could brute-force auth tokens offline.

More importantly: conceptually the server is still acting as the **verifier of a password derivative**. True zero-knowledge authentication means the server learns nothing about the password — not even a hash.

---

## Option A: SRP (Secure Remote Password Protocol)

### What it is

SRP is a well-established password-authenticated key exchange (PAKE) protocol. The server stores a **verifier** derived from the password (not the password itself, and not a hash that can be directly cracked). Authentication proceeds as an interactive proof: the client proves it knows the password without ever sending it or a hash of it.

### How it works (simplified)

**Registration:**

1. Client generates a random **salt** `s`
2. Client computes: `x = H(s || H(username || ":" || password))`
3. Client computes the verifier: `v = g^x mod N` (where `g`, `N` are public SRP group parameters)
4. Client sends `(username, s, v)` to the server — the server stores `(s, v)`, never seeing the password

**Authentication:**

1. Server sends the salt `s` and a random ephemeral public value `B` to the client
2. Client computes its own ephemeral value `A` and a shared session key `K` using `B`, `x`, and SRP math
3. Server computes the same `K` using `A`, `v`, and its private ephemeral value
4. Both sides prove they computed the same `K` via a mutual proof exchange (M1/M2 messages)
5. If both proofs verify, authentication is complete and both sides hold a shared secret `K` — but the server never learned the password

**Key delivery (how keys reach the client):**

The server can encrypt the wrapped RSA private key (or even the master key) under `K` (or a KDF derivative of `K`). The client decrypts this with its copy of `K`, then proceeds with Argon2id + AES-GCM as today.

Alternatively, `K` can replace the Argon2id-derived key entirely: the RSA private key would be re-encrypted under a key derived from the SRP session key rather than the password directly.

### Cryptographic properties

- The server stores only the verifier `v = g^x mod N`, which is computationally infeasible to invert (discrete log problem)
- The session key `K` is ephemeral and different on every login — forward secrecy
- An attacker intercepting the authentication exchange cannot reconstruct the password or session key without solving the discrete log
- The mutual proof (M1/M2) means neither side can be impersonated

### Tradeoffs

| Aspect                    | Notes                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maturity                  | RFC 5054, widely deployed (e.g., Apple iCloud Keychain uses SRP)                                                                                   |
| Implementation complexity | Medium — requires bignum arithmetic; libraries exist                                                                                               |
| Server changes            | Supabase Auth does not support SRP natively; requires a custom Edge Function to handle the SRP handshake, plus a table to store `(salt, verifier)` |
| Password change           | Must update verifier and re-encrypt keys under new session key derivation                                                                          |
| Offline attack resistance | High — verifier cannot be directly cracked without solving discrete log                                                                            |

---

## Option B: OPAQUE (Asymmetric PAKE)

### What it is

OPAQUE is a newer asymmetric PAKE protocol (IETF draft, actively being standardized). It improves on SRP by providing **stronger security guarantees** and being resistant to pre-computation attacks even if the server database is compromised.

### How it works (simplified)

OPAQUE combines an **Oblivious Pseudo-Random Function (OPRF)** with asymmetric key exchange:

**Registration:**

1. Client picks a random blinding factor `r`, computes `blinded = H(password)^r` (an OPRF input)
2. Server evaluates the OPRF using its secret key `k`: `response = blinded^k`
3. Client unblinds: `rwd = H(password)^k` (the "randomized password" — the client learns this, not the server)
4. Client derives a key from `rwd`, generates an asymmetric key pair (e.g., ECDH), and stores an **encrypted envelope** on the server containing its private key — encrypted under a key derived from `rwd`
5. Server stores: OPRF output, public key, encrypted envelope — but never `rwd` or the password

**Authentication:**

1. The same OPRF interaction occurs — client obtains the same `rwd` if and only if the password is correct
2. Client decrypts its envelope using `rwd`, recovering its private key
3. Standard asymmetric key exchange (e.g., ECDH) establishes a shared session key
4. Both sides hold the session key; existing encrypted keys can be delivered under it

**Key delivery:**

The encrypted envelope stored on the server already contains client key material (e.g., the Argon2id salt and parameters, or a master key seed). The server delivers the envelope; the client can only open it if it correctly re-derives `rwd` from the real password. If the password is wrong, the envelope decryption fails — no round-trip needed.

### Cryptographic properties

- Server never learns `rwd`, the password, or any derivative that directly enables offline attacks
- Even with the full server database, an attacker must perform an online OPRF query per password guess — there is no offline dictionary attack
- Provides **mutual authentication** — the client also authenticates the server
- The envelope is authenticated (AEAD), so a compromised server cannot substitute a fake envelope undetected

### Tradeoffs

| Aspect                    | Notes                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Maturity                  | IETF draft (draft-irtf-cfrg-opaque); reference implementations exist but fewer battle-tested libraries than SRP |
| Implementation complexity | Higher than SRP; requires OPRF implementation (curve operations)                                                |
| Server changes            | Same as SRP — requires custom Edge Function; no native Supabase support                                         |
| Offline attack resistance | Strongest of all options — no offline attack even with server database                                          |
| Forward secrecy           | Full forward secrecy on session keys                                                                            |

---

## Option C: OPRF-Hardened Token (Lightweight Middle Ground)

### What it is

A simpler approach that keeps the current SHA-256 token structure but hardens it with a **server-side OPRF step**. This does not provide full PAKE properties but eliminates offline dictionary attacks against the auth token.

### How it works

**Registration:**

1. Client computes `token = SHA-256(username:password)` (same as today)
2. Before storing or using the token, the client sends it to a server-side OPRF endpoint (Edge Function)
3. The server blindly evaluates: `hardened = HMAC(serverSecret, token)` using a secret key only the server knows
4. `hardened` (not `token`) is used as the Supabase Auth password
5. The server also uses `hardened` to derive an encryption key to wrap the user's RSA private key before storing it

**Authentication:**

1. Client computes `token` as before
2. Client sends `token` to the OPRF endpoint, receives `hardened`
3. Client authenticates to Supabase Auth using `hardened`
4. Client uses `hardened` (or a derivative) to decrypt the RSA private key wrapper

### Cryptographic properties

- The value stored in Supabase Auth is `HMAC(serverSecret, SHA-256(username:password))` — cracking it requires knowing the server secret
- Offline dictionary attacks become impossible even if the Supabase Auth database is leaked (without the server OPRF secret)
- The server OPRF secret is the single new critical secret to protect

### Tradeoffs

| Aspect                    | Notes                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Implementation complexity | Low — just one HMAC call in an Edge Function                                                               |
| Server changes            | Small — one new Edge Function, one server secret                                                           |
| Protection                | Prevents offline attacks on the auth token; does not provide full zero-knowledge properties                |
| Key delivery              | No change to key delivery — still Argon2id on the client as today                                          |
| Weakness                  | Server still verifies the hardened token (knows `serverSecret`); not true ZK, but much stronger than today |

---

## Recommendation and Compatibility Notes

All three options are **additive** — they change how the auth token is computed and verified, but the underlying key chain (Argon2id → RSA → master key → field keys) is unchanged. The password continues to be used client-side for key derivation exactly as it is today.

The minimum change for meaningful security improvement is **Option C**, which could be implemented as a single Edge Function with no changes to the key storage or encryption layers.

**Option A (SRP)** is the most practical path to true ZK authentication with well-tested libraries and a clear IETF specification.

**Option B (OPAQUE)** offers the strongest security model and is the modern recommendation from cryptographers, but requires more implementation work and careful library selection.

---

## Supabase Auth Is a Black Box

### The fundamental constraint

Supabase Auth only supports email/password (bcrypt internally), OAuth providers, and magic links/OTP. There is no way to plug a custom verification protocol into it. This means `supabase.auth.signInWithPassword()` cannot be used for ZK auth — the handshake has to be replaced entirely.

### The workaround: Edge Functions + session minting

The only viable path is a two-phase approach:

1. Run the ZK handshake yourself via Edge Functions
2. After the handshake succeeds, mint a Supabase session using the service-role key (`supabase.auth.admin.createSession(userId)`)

Supabase still holds a user record (needed for RLS and JWT), but its internal password field becomes meaningless — the real authentication gate moves to the ZK verifier stored in your own table. The Edge Function that mints sessions becomes a **highly privileged component**: it can issue a session for any user, so it must be written carefully.

### New tables required

The current `profiles` and `user_keys` tables are not enough. Two new tables would be needed:

- **Verifier table** — stores the per-user salt and ZK verifier (replaces the password in Supabase Auth). Must be readable by Edge Functions via the service role but never directly by the client.
- **Ephemeral challenge table** — stores short-lived server-side ephemeral values (e.g., `B` in SRP) tied to a session ID, with a TTL. Required because SRP/OPAQUE is a two-round protocol: the server generates a challenge, waits for the client response, and the intermediate state must live somewhere between those two calls.

### The protocol is multi-round, not a single call

Today login is one HTTP call. SRP requires two round trips:

1. Client sends username → server responds with salt + ephemeral `B`
2. Client sends proof `M1` → server verifies, responds with proof `M2` + minted session

This means two Edge Function calls per login, plus state kept between them in the ephemeral challenge table (with short expiry to prevent replay attacks).

### Registration must also change

With ZK, registration needs to:

1. Compute the verifier client-side
2. Send the verifier (not the password) to an Edge Function
3. The Edge Function creates the Supabase Auth user (with a random placeholder password) and stores the verifier in the verifier table

### Password change complexity

Today `changePassword` calls `supabase.auth.updateUser({ password: newAuthToken })`. With ZK a password change requires:

1. Re-running the ZK handshake to prove knowledge of the old password
2. Computing a new verifier from the new password
3. Updating the verifier table via Edge Function
4. Re-encrypting the RSA private key with the new password (this part stays the same as today)

### What would and would not change

| Component                | Changes                                                                         |
| ------------------------ | ------------------------------------------------------------------------------- |
| `usernameAuthService.ts` | Replace `signInWithPassword` / `signUp` with multi-round ZK protocol            |
| Supabase tables          | Add verifier table + ephemeral challenge table                                  |
| Edge Functions           | 3-4 new functions: init, verify, register, change-password                      |
| Session minting          | Edge Function uses service-role key to issue session after ZK success           |
| RLS policies             | Lock down verifier table so only Edge Functions (service role) can read it      |
| `authStore.ts`           | Update `changePassword` to re-run ZK proof before updating                      |
| Encryption layer         | **No change** — Argon2id, RSA, master key, and field keys work exactly as today |

The encryption layer does not change at all. The password continues to be used client-side for key derivation exactly as it is today. Only the authentication step — what the server uses to verify the user — is replaced.

---

## Key Delivery Under Any Option

Regardless of which auth protocol is chosen, the flow for delivering encrypted keys to the client remains structurally the same:

1. Client authenticates (via SRP / OPAQUE / hardened token)
2. Server returns the encrypted key material (`rsa_private_key_encrypted`, `wrapped_master_key`) — this is safe because the data is encrypted and useless without the password
3. Client uses the password + Argon2id to decrypt the RSA private key (client-side only)
4. Client uses the RSA private key to unwrap the master key (client-side only)
5. No plaintext key material ever leaves the client

The only part that currently relies on a password-derivative reaching the server is **step 1**. Options A, B, and C each replace that step with a cryptographically stronger alternative.
