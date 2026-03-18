import zkAuthDoc from '../../docs/zero-knowledge-auth.md?raw'

export interface RoadmapStep {
  title: string
  goal: string
  flow: string[]
  securityGain: string[]
  dangers: string[]
  detailsDoc?: string
}

export const roadmapSteps: RoadmapStep[] = [
  {
    title: 'Password-Only Encryption',
    goal: "Derive a PBKDF2-based key from the user's password (plus a random salt) and use that key directly with AES-GCM to encrypt/decrypt all fields.",
    flow: [
      'User enters password → PBKDF2 (with a per-field random salt) creates the Password-derived key (kept only in RAM).',
      'The Password-derived key is fed straight into AES-GCM to encrypt every data field.',
      "Ciphertexts, along with the PBKDF2 salt and AES-GCM nonce, are stored in the browser's local storage.",
      'On subsequent logins the same password reproduces the same key, allowing decryption.',
    ],
    securityGain: [
      'The password now protects a single symmetric key that encrypts all data.',
      'Plain-text storage is eliminated.',
      'An attacker must first recover the password (via offline guessing) before any data can be read.',
    ],
    dangers: [
      "All data is protected only by the strength of the user's password.",
      'If the password is weak or reused, an attacker who obtains the ciphertext can launch an offline dictionary attack and recover every field.',
      'No key-rotation mechanism; changing the password forces a full re-encryption of every record.',
    ],
  },
  {
    title: 'Derive Password-Derived Key with Argon2id',
    goal: "To turn the user's password into a strong symmetric key for subsequent operations, instead of PBKDF2, use Argon2id via the 'hash-wasm' library (not 'argon2-browser' library as it doesn't work with vite and vitest properly).",
    flow: [
      'User enters password.',
      'Generate a random 128-bit salt (store it with the encrypted data).',
      'Run Argon2id with chosen memory, time, and parallelism parameters to produce a 256-bit raw key.',
      'Import the raw key into Web Crypto (crypto.subtle.importKey) for AES-GCM usage.',
    ],
    securityGain: [
      'Memory-hard resistance to GPU/ASIC attacks makes offline password cracking far harder than PBKDF2.',
      'Stronger key derivation improves overall protection of any data encrypted with the derived key.',
    ],
    dangers: [
      'All data remains encrypted directly with the password derived key, so a compromised password (or a successful Argon2id crack) would immediately expose the entire dataset.',
      'No RSA key pair exists yet, so you cannot separate password-based protection from the encryption of the actual payload. This makes key rotation and granular access control much harder.',
    ],
  },
  {
    title: 'Introduce RSA Wrapper',
    goal: 'Generate a random RSA-OAEP key pair. Encrypt the RSA private key with the password-derived key (AES-GCM) and store the encrypted private key alongside the RSA public key.',
    flow: [
      'User enters password → Argon2id → Password-derived key (RAM only) → Encrypts data (no change from previous step)',
      'Password-derived key decrypts the stored RSA private key (to unwrap a master key in the next step).',
    ],
    securityGain: [
      'The RSA private key is now safely stored (encrypted with the password-derived key), so the private key itself cannot be read without the correct password.',
      'When the next step is completed, this RSA key pair will be able to protect the master key, providing a clean separation between password-based protection and data-encryption keys.',
    ],
    dangers: [
      'A compromised password (or a successful Argon2id crack) would still expose the entire dataset because the RSA key is not yet used for any data protection.',
      'Until a master key is introduced, you still have to encrypt all data directly with the password-derived key (or with the RSA private key, which would be less efficient).',
    ],
  },
  {
    title: 'Add Random Master Key (Wrapped by RSA)',
    goal: 'Generate a fresh 256-bit symmetric master key and wrap (encrypt) it with the RSA public key using RSA-OAEP. Store only the wrapped master key.',
    flow: [
      'At first run, generate a random 256-bit master key (kept in RAM only).',
      'Wrap the master key with the RSA public key → produce a wrapped-master-blob.',
      'Store the wrapped-master-blob alongside the encrypted RSA private key.',
      'Remove the password derived key data encryption and encrypt the data with the master key.',
    ],
    securityGain: [
      "Bulk data is now protected by a high-entropy random key instead of the user's password.",
      'The master key can be rotated independently of the password or RSA key pair.',
    ],
    dangers: [
      'Existing records encrypted with the old password-derived key remain vulnerable until they are migrated.',
      'If the wrapped master key is lost or corrupted, all data encrypted with it becomes unrecoverable.',
    ],
  },
  {
    title: 'Field-Specific Key Derivation (HKDF)',
    goal: 'Derive a unique symmetric key for each data field from the master key using HKDF with a per-field salt (or field name).',
    flow: [
      'Master key (in RAM) → HKDF + field-specific salt → Field-specific key.',
      'Field-specific key → AES-GCM encrypt/decrypt the corresponding field value.',
      'Store the per-field salt (or identifier) together with the ciphertext.',
    ],
    securityGain: [
      'Compromise of one field-specific key does not reveal other fields.',
      'Granular key control enables selective revocation or re-encryption of individual fields.',
    ],
    dangers: [
      'Without rotation, security is permanently capped at the weakest password ever used + the RSA key generated on first setup.',
      'No forward secrecy — single master-key compromise (today or in 10 years) decrypts all historical and future data.',
    ],
  },
  {
    title: 'Key-Rotation',
    goal: 'Provide utilities to rotate the password-derived key and RSA key pair without downtime.',
    flow: [
      'Password rotation: prompt user for a new password, re-encrypt the existing RSA private key with the new password-derived key.',
      'RSA rotation: generate a new RSA pair, re-wrap the existing master key with the new public key, replace stored public key.',
      "Do not add Master-key rotation as that would require re-encrypting all of the user's data.",
    ],
    securityGain: [
      'Limits the exposure window of any single key, complying with best-practice key-lifecycle policies.',
      'Allows rapid response to suspected RSA key compromise without needing a full data dump.',
    ],
    dangers: [
      'Without a brute-force protection, unlimited offline password guessing remains possible.',
      'Even frequent password rotation becomes almost useless against automated attacks on a stolen device.',
    ],
  },
  {
    title: 'Add Brute-Force & Wrong-Password Protection',
    goal: 'Prevent unlimited offline password guessing against Argon2id-derived keys.',
    flow: [
      'Implement exponential backoff (e.g. 1s → 2s → 4s → 30s → 5min lock) on failed unlock attempts',
      'Add configurable max attempts before longer cooldown (e.g. 10 fails → 1 hour lock)',
      'Persist failed attempt counter in IndexedDB (encrypted or HMAC-protected)',
    ],
    securityGain: [
      'Makes practical offline attacks orders of magnitude slower/harder even with stolen device',
      'Complements Argon2id computational cost with time-based throttling',
    ],
    dangers: [
      'Without secure session and memory management, field keys and master key stay in memory after lock.',
      'An attacker with brief post-lock access can still decrypt everything, making rotation and brute-force protection far less effective.',
    ],
  },
  {
    title: 'Secure Session & Memory Management',
    goal: 'Ensure keys and sensitive data are cleared from memory when no longer needed.',
    flow: [
      'Implement automatic lock after idle timeout (5-15 min configurable)',
      'Clear masterKey, fieldKeys Map, passwordInput ref on lock / timeout / visibilitychange / beforeunload',
      'Use secure zeroing patterns where possible (though limited in JS — at least null references + gc encouragement)',
    ],
    securityGain: [
      'Prevents shoulder-surfing, evil-maid and post-lock memory inspection attacks',
      'Reduces window during which master & field keys live in RAM',
    ],
    dangers: [
      'Without Argon2id strengthening, weak password-derived keys remain relatively cheap to brute-force long-term.',
      'Even with rotation and session cleanup, security is still capped by outdated KDF parameters.',
    ],
  },
  {
    title: 'Strengthen Argon2id Parameters & Calibration',
    goal: 'Bring password-to-key derivation closer to 2026 OWASP / NIST recommendations.',
    flow: [
      'Increase iterations (target 0.8-2 seconds on low-end mobile devices)',
      'Consider raising memory to 128-194 MiB if UX allows',
      'Add optional calibration function or documented tuning guide for different devices',
    ],
    securityGain: [
      'Significantly raises cost of brute-force / dictionary attacks',
      'Makes password rotation more effective (stronger wrapper for RSA private key)',
    ],
    dangers: [
      'Without RSA upgrade, the 2048-bit RSA key remains the long-term weak link.',
      'Even strong password-derived keys wrap an aging asymmetric algorithm that NIST/BSI recommend replacing.',
    ],
  },
  {
    title: 'Upgrade RSA Key Size',
    goal: 'Move beyond aging RSA-2048 toward future-proof key wrapping.',
    flow: [
      'During RSA key generation, generate 4096-bit keys instead of 2048',
      'For compatibility, try first 4096, if it fails, try 3072, if it fails, fallback to 2048',
    ],
    securityGain: [
      'Raises security level from ~112 bits to 128+ bits (better aligned with AES-256)',
      'Follows NIST/BSI/ANSSI guidance for long-term protection past 2030',
    ],
    dangers: [
      'Without versioning, future crypto upgrades (stronger parameters, new algorithms, post-quantum) become extremely risky or impossible without breaking old data or forcing full re-encryption.',
    ],
  },
  {
    title: 'Add Basic Key & Format Versioning',
    goal: 'Prepare for future crypto changes without forcing full re-encryption.',
    flow: ['Embed version tag in AAD (e.g. "v1")', 'Add version prefix or metadata field when storing encrypted notes'],
    securityGain: ['Enables safe future upgrades (stronger Argon2id, new algorithms, etc.)'],
    dangers: [
      'With the broken AAD binding, the entire cryptographic protocol remains fundamentally flawed.',
      'Encrypted notes can still be silently swapped between users even after all rotations and upgrades.',
    ],
  },
  {
    title: 'Add Supabase and Fix Broken AAD Binding',
    goal: 'Add Supabase and make AAD actually bind encrypted blobs to the correct user and field to prevent substitution / mix-up attacks.',
    flow: [
      'Add Supabase and replace local storage with Supabase for storing encrypted data',
      'Replace hardcoded "TODO:note" with proper per-user + per-field AAD construction (e.g. userId + fieldId + version tag)',
      'Update all encryption calls in useEncryptedNote / fieldKeyService / passwordDerivedService to use real AAD',
    ],
    securityGain: [
      'Provides authentication for multiple users and secure storage for encrypted data',
      'Prevents silent blob-swapping attacks between users (critical for any future multi-user or cloud-sync feature)',
      'Restores intended authenticity guarantees of AES-GCM and makes all previous rotation work actually meaningful',
    ],
    dangers: [
      'Without zero-knowledge authentication, the password (or a derivative) is still transmitted to the server on every login, meaning a server breach or a compromised Supabase instance can expose the credentials that protect the encrypted RSA private key.',
      'An attacker who obtains the server database and the transmitted password hash can launch an offline dictionary attack directly against Argon2id, bypassing all client-side key protections.',
    ],
  },
  {
    title: 'Zero-Knowledge Authentication',
    goal: 'Remove the password from the server entirely by replacing the current SHA-256 auth token with a true zero-knowledge protocol, so that even a full Supabase database breach cannot expose user passwords or keys.',
    flow: [
      'Evaluate three candidate protocols: SRP (Secure Remote Password), OPAQUE (asymmetric PAKE), or OPRF-Hardened Token.',
      'Implement the chosen protocol via Supabase Edge Functions to handle multi-round handshakes.',
      'Replace SHA-256("username:password") auth token with the ZK protocol output.',
      'Update password-change flow to re-register the verifier or blinded credential with the server.',
    ],
    securityGain: [
      'The plaintext password and any derivative never leave the client — the server only ever sees a verifier or blinded token.',
      'A full server database compromise does not expose passwords or allow offline dictionary attacks.',
      'OPAQUE additionally provides mutual authentication, protecting against phishing and server impersonation.',
    ],
    dangers: [],
    detailsDoc: zkAuthDoc,
  },
]
