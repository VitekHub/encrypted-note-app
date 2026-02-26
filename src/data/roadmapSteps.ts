export interface RoadmapStep {
  title: string
  goal: string
  flow: string[]
  securityGain: string[]
  dangers: string[]
}

export const roadmapSteps: RoadmapStep[] = [
  {
    title: 'Password-Only Encryption',
    goal: 'Derive a PBKDF2-based key from the user\'s password (plus a random salt) and use that key directly with AES-GCM to encrypt/decrypt all fields.',
    flow: [
      'User enters password → PBKDF2 (with a per-field random salt) creates the Password-derived key (kept only in RAM).',
      'The Password-derived key is fed straight into AES-GCM to encrypt every data field.',
      'Ciphertexts, along with the PBKDF2 salt and AES-GCM nonce, are stored in the browser\'s local storage.',
      'On subsequent logins the same password reproduces the same key, allowing decryption.'
    ],
    securityGain: [
      'The password now protects a single symmetric key that encrypts all data.',
      'Plain-text storage is eliminated.',
      'An attacker must first recover the password (via offline guessing) before any data can be read.'
    ],
    dangers: [
      'All data is protected only by the strength of the user\'s password.',
      'If the password is weak or reused, an attacker who obtains the ciphertext can launch an offline dictionary attack and recover every field.',
      'No key-rotation mechanism; changing the password forces a full re-encryption of every record.'
    ]
  },
  {
    title: 'Derive Password-Derived Key with Argon2id',
    goal:
      'Use Argon2id (via the argon2-browser library) instead of PBKDF2 to turn the user\'s password into a strong symmetric key for subsequent operations.',
    flow: [
      'User enters password.',
      'Generate a random 128-bit salt (store it with the encrypted data).',
      'Run Argon2id with chosen memory, time, and parallelism parameters to produce a 256-bit raw key.',
      'Import the raw key into Web Crypto (crypto.subtle.importKey) for AES-GCM usage.'
    ],
    securityGain: [
      'Memory-hard resistance to GPU/ASIC attacks makes offline password cracking far harder than PBKDF2.',
      'Stronger key derivation improves overall protection of any data encrypted with the derived key.'
    ],
    dangers: [
      'All data remains encrypted directly with the password derived key, so a compromised password (or a successful Argon2id crack) would immediately expose the entire dataset.',
      'No RSA key pair exists yet, so you cannot separate password-based protection from the encryption of the actual payload. This makes key rotation and granular access control much harder.'
    ]
  },
  {
    title: 'Introduce RSA Wrapper',
    goal:
      'Generate a random RSA-OAEP key pair. Encrypt the RSA private key with the password-derived key (AES-GCM) and store the encrypted private key alongside the RSA public key.',
    flow: [
      'User enters password → Argon2id → Password-derived key (RAM only) → Encrypts data (no change from previous step)',
      'Password-derived key decrypts the stored RSA private key (to unwrap a master key in the third step).'
    ],
    securityGain: [
      'The password now protects a small RSA private key instead of the entire data set.',
      'Compromise of the password alone does not immediately expose all user data.'
    ],
    dangers: [
      'The RSA private key is the only secret protecting the data; if an attacker extracts the encrypted private key and cracks the password, they obtain the RSA private key and can subsequently unwrap any master key you later add.',
      'Until a master key is introduced, you still have to encrypt all data directly with the password-derived key (or with the RSA private key, which would be less efficient).'
    ]
  },
  {
    title: 'Add Random Master Key (Wrapped by RSA)',
    goal:
      'Generate a fresh 256-bit symmetric master key and wrap (encrypt) it with the RSA public key using RSA-OAEP. Store only the wrapped master key.',
    flow: [
      'At first run, generate a random 256-bit master key (kept in RAM only).',
      'Wrap the master key with the RSA public key → produce a wrapped-master-blob.',
      'Store the wrapped-master-blob alongside the encrypted RSA private key.'
    ],
    securityGain: [
      'Bulk data is now protected by a high-entropy random key instead of the user\'s password.',
      'The master key can be rotated independently of the password or RSA key pair.'
    ],
    dangers: [
      'Existing records encrypted with the old password-derived key remain vulnerable until they are migrated.',
      'If the wrapped master key is lost or corrupted, all data encrypted with it becomes unrecoverable.'
    ]
  },
  {
    title: 'Field-Specific Key Derivation (HKDF)',
    goal:
      'Derive a unique symmetric key for each data field from the master key using HKDF with a per-field salt (or field name).',
    flow: [
      'Master key (in RAM) → HKDF + field-specific salt → Field-specific key.',
      'Field-specific key → AES-GCM encrypt/decrypt the corresponding field value.',
      'Store the per-field salt (or identifier) together with the ciphertext.'
    ],
    securityGain: [
      'Compromise of one field-specific key does not reveal other fields.',
      'Granular key control enables selective revocation or re-encryption of individual fields.'
    ],
    dangers: [
      'If migration stops here, the database contains a mix of three encryption schemes (password-only, master-key-only, field-specific), increasing complexity and risk of bugs.',
      'Losing or mismatching a field-specific salt makes future decryption impossible for that field.'
    ]
  },
  {
    title: 'Full Migration & Cleanup',
    goal:
      'Re-encrypt all existing records from the old scheme(s) to the new field-specific key pipeline and remove obsolete artifacts.',
    flow: [
      'Iterate over every stored record.',
      'Decrypt using the appropriate legacy method (password-only or master-key).',
      'Derive the new field-specific key from the master key and re-encrypt the field.',
      'Replace the old ciphertext with the new one and record the field-salt.',
      'After all rows are processed, delete the old password-derived-only ciphertexts and optionally purge the encrypted RSA private key if no longer needed for wrapping.'
    ],
    securityGain: [
      'All data now resides exclusively under the strongest tier: field-specific keys derived from a random master key.',
      'Legacy weak encryption paths are eliminated, removing the weakest link in the chain.'
    ],
    dangers: [
      'An interruption leaves a partially migrated dataset, creating a security hole where some rows remain vulnerable.',
      'A buggy migration script could corrupt data or cause duplicate entries, leading to potential data loss.'
    ]
  },
  {
    title: 'Key-Rotation & Maintenance Toolkit',
    goal:
      'Provide utilities to rotate the password-derived key, RSA key pair, master key, and field-specific keys without downtime.',
    flow: [
      'Password rotation: prompt user for a new password, re-encrypt the RSA private key with the new password-derived key.',
      'RSA rotation: generate a new RSA pair, re-wrap the existing master key with the new public key, replace stored public key.',
      'Master-key rotation: generate a fresh master key, wrap it with the current RSA public key, optionally re-derive field-specific keys.',
      'Field-key rotation (optional): re-derive per-field keys from the new master key and re-encrypt affected fields.'
    ],
    securityGain: [
      'Limits the exposure window of any single key, complying with best-practice key-lifecycle policies.',
      'Allows rapid response to suspected key compromise without needing a full data dump.'
    ],
    dangers: [
      'Missing rotation procedures forces ad-hoc manual updates later, increasing the chance of errors and data loss.',
      'Improperly sequenced rotations (e.g., rotating RSA before re-wrapping the master key) could render the master key inaccessible.'
    ]
  }
]
