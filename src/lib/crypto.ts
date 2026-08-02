/**
 * Web Crypto AES-256-GCM Encryption / Decryption Module
 * Option A: Derives PBKDF2 256-bit AES key dynamically from session token/passphrase.
 * Fail Closed: Throws explicit error on decryption or encryption failure.
 */

async function deriveKey(passphrase: string, salt?: Uint8Array): Promise<CryptoKey> {
  if (!passphrase || passphrase.trim() === '') {
    throw new Error('Encryption passphrase / session token is required')
  }

  const enc = new TextEncoder()
  const derivedSalt = salt || enc.encode('staykids-crypto-salt-v2-' + passphrase.substring(0, 8))
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: derivedSalt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptData(plainText: string, passphrase?: string): Promise<string> {
  if (!passphrase) {
    throw new Error('Encryption failed: Auth session passphrase is required.')
  }
  const salt = crypto.getRandomValues(new Uint8Array(16)) // Random salt per encryption
  const key = await deriveKey(passphrase, salt)
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for AES-GCM
  const encoded = new TextEncoder().encode(plainText)

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )

  const cipherArray = new Uint8Array(cipherBuffer)
  const combined = new Uint8Array(salt.length + iv.length + cipherArray.length)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(cipherArray, salt.length + iv.length)

  return btoa(String.fromCharCode(...combined))
}

export async function decryptData(cipherBase64: string, passphrase?: string): Promise<string> {
  if (!passphrase) {
    throw new Error('Decryption failed: Auth session passphrase is required.')
  }
  const combined = Uint8Array.from(atob(cipherBase64), (c) => c.charCodeAt(0))
  if (combined.length <= 28) {
    throw new Error('Decryption failed: Invalid ciphertext length.')
  }

  const salt = combined.slice(0, 16)
  const iv = combined.slice(16, 28)
  const cipherText = combined.slice(28)
  const key = await deriveKey(passphrase, salt)

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherText
  )

  return new TextDecoder().decode(decryptedBuffer)
}
