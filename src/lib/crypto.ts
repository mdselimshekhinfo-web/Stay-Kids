/**
 * Web Crypto AES-256-GCM Encryption / Decryption Module
 */

const SECRET_SALT = new TextEncoder().encode('staykids-crypto-salt-v1')
const MASTER_PASSPHRASE = 'staykids-secure-offline-vault-key'

async function deriveKey(): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(MASTER_PASSPHRASE),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SECRET_SALT,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptData(plainText: string): Promise<string> {
  try {
    const key = await deriveKey()
    const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for AES-GCM
    const encoded = new TextEncoder().encode(plainText)

    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    )

    const cipherArray = new Uint8Array(cipherBuffer)
    const combined = new Uint8Array(iv.length + cipherArray.length)
    combined.set(iv, 0)
    combined.set(cipherArray, iv.length)

    return btoa(String.fromCharCode(...combined))
  } catch (err) {
    console.error('AES-256 Encryption failed:', err)
    return plainText // Fallback unencrypted if Web Crypto unavailable
  }
}

export async function decryptData(cipherBase64: string): Promise<string> {
  try {
    const combined = Uint8Array.from(atob(cipherBase64), (c) => c.charCodeAt(0))
    if (combined.length <= 12) return cipherBase64

    const iv = combined.slice(0, 12)
    const cipherText = combined.slice(12)
    const key = await deriveKey()

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherText
    )

    return new TextDecoder().decode(decryptedBuffer)
  } catch (_err) {
    // If decryption fails (e.g. legacy plain text data), return raw string
    return cipherBase64
  }
}
