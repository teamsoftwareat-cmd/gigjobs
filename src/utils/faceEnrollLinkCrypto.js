const DEFAULT_SECRET = 'cynosure-face-enrollment-link-v1'

const getSecret = () => String(import.meta.env.VITE_FACE_ENROLL_LINK_SECRET || DEFAULT_SECRET)

const toBase64Url = (bytes) => {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const fromBase64Url = (value) => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const getKey = async () => {
  const secretBytes = new TextEncoder().encode(getSecret())
  const keyBytes = await crypto.subtle.digest('SHA-256', secretBytes)
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export const encryptFaceEnrollUserId = async (userId) => {
  if (!userId) throw new Error('A candidate ID is required.')

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await getKey()
  const encoded = new TextEncoder().encode(String(userId))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const encryptedBytes = new Uint8Array(encrypted)
  const payload = new Uint8Array(iv.length + encryptedBytes.length)
  payload.set(iv)
  payload.set(encryptedBytes, iv.length)
  return toBase64Url(payload)
}

export const decryptFaceEnrollUserId = async (token) => {
  if (!token) throw new Error('Enrollment token is missing.')

  const payload = fromBase64Url(token)
  if (payload.length <= 12) throw new Error('Enrollment token is invalid.')

  const iv = payload.slice(0, 12)
  const encrypted = payload.slice(12)
  const key = await getKey()
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)
  return new TextDecoder().decode(decrypted)
}

export const encryptRegistrationId = encryptFaceEnrollUserId
export const decryptRegistrationId = decryptFaceEnrollUserId
