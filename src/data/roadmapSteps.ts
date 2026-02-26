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
  }
]
