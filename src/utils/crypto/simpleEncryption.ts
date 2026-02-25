const ITERATIONS = 100_000

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const buf = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
  return buf
}

async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptField(plaintext: string, password: string): Promise<string> {
  const enc = new TextEncoder()
  const saltArr = crypto.getRandomValues(new Uint8Array(16))
  const ivArr = crypto.getRandomValues(new Uint8Array(12))
  const salt = saltArr.buffer as ArrayBuffer
  const iv = ivArr.buffer as ArrayBuffer
  const key = await deriveKey(password, salt)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  )
  return [bufferToBase64(salt), bufferToBase64(iv), bufferToBase64(ciphertext)].join(':')
}

export async function decryptField(encoded: string, password: string): Promise<string> {
  const parts = encoded.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted format')
  const [saltB64, ivB64, ciphertextB64] = parts
  const salt = base64ToBuffer(saltB64)
  const iv = base64ToBuffer(ivB64)
  const ciphertext = base64ToBuffer(ciphertextB64)
  const key = await deriveKey(password, salt)
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plainBuffer)
}

export function isEncrypted(value: string): boolean {
  const parts = value.split(':')
  return parts.length === 3 && parts.every((p) => p.length > 0)
}
