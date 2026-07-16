import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { publicUrl } from '../utils/publicUrl';
import { SecureEnvelope, SecurePayload } from './types';

type VaultStatus = 'locked' | 'unlocking' | 'unlocked' | 'error';

interface SecureDataContextValue {
  status: VaultStatus;
  data: SecurePayload | null;
  error: string;
  unlock: (passphrase: string, rememberForSession?: boolean) => Promise<boolean>;
  lock: () => void;
}

const SecureDataContext = createContext<SecureDataContextValue | null>(null);
const SESSION_KEY = 'apartment_vault_session_key';

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveKey(passphrase: string, envelope: SecureEnvelope): Promise<CryptoKey> {
  const sourceKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: envelope.kdf.hash,
      salt: base64ToBytes(envelope.kdf.salt),
      iterations: envelope.kdf.iterations,
    },
    sourceKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

async function decryptBytes(key: CryptoKey, ciphertext: ArrayBuffer, iv: string): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    key,
    ciphertext,
  );
}

async function mapWithConcurrency<T, R>(
  entries: T[],
  concurrency: number,
  worker: (entry: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(entries.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < entries.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(entries[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, entries.length) }, () => runWorker()),
  );
  return results;
}

function isSecurePayload(value: unknown): value is SecurePayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<SecurePayload>;
  return Array.isArray(payload.wifi)
    && Array.isArray(payload.checkin)
    && !!payload.instructionsVi
    && !!payload.instructionsEn
    && !!payload.assets;
}

export function SecureDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('locked');
  const [data, setData] = useState<SecurePayload | null>(null);
  const [error, setError] = useState('');
  const objectUrlsRef = useRef<string[]>([]);
  const unlockInProgressRef = useRef(false);

  const revokeObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  const lock = useCallback(() => {
    revokeObjectUrls();
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Storage may be unavailable. */ }
    setData(null);
    setError('');
    setStatus('locked');
  }, [revokeObjectUrls]);

  const unlock = useCallback(async (passphrase: string, rememberForSession = true) => {
    if (!passphrase.trim() || unlockInProgressRef.current) return false;
    unlockInProgressRef.current = true;
    setStatus('unlocking');
    setError('');

    try {
      const envelopeResponse = await fetch(publicUrl('secure/secure-data.json'));
      if (!envelopeResponse.ok) {
        throw new Error('Protected data package is missing from this deployment.');
      }

      const envelope = await envelopeResponse.json() as SecureEnvelope;
      const key = await deriveKey(passphrase, envelope);
      const decryptedPayloadBytes = await decryptBytes(
        key,
        base64ToBytes(envelope.data.ciphertext).buffer,
        envelope.data.iv,
      );
      const parsedPayload: unknown = JSON.parse(new TextDecoder().decode(decryptedPayloadBytes));

      if (!isSecurePayload(parsedPayload)) {
        throw new Error('Protected data has an unsupported format.');
      }

      revokeObjectUrls();
      const assetEntries = Object.entries(parsedPayload.assets);
      const decryptedAssets = await mapWithConcurrency(assetEntries, 4, async ([originalUrl, descriptor]) => {
        const response = await fetch(publicUrl(descriptor.file));
        if (!response.ok) throw new Error(`Unable to open protected image: ${originalUrl}`);
        const decrypted = await decryptBytes(key, await response.arrayBuffer(), descriptor.iv);
        const objectUrl = URL.createObjectURL(new Blob([decrypted], { type: descriptor.mimeType }));
        objectUrlsRef.current.push(objectUrl);
        return [originalUrl, objectUrl] as const;
      });

      const assetUrlMap = Object.fromEntries(decryptedAssets);
      const hydratedPayload: SecurePayload = {
        ...parsedPayload,
        checkin: parsedPayload.checkin.map(record => ({
          ...record,
          photos: record.photos.map(photo => ({
            ...photo,
            url: assetUrlMap[photo.url] || '',
          })),
        })),
      };

      try {
        if (rememberForSession) sessionStorage.setItem(SESSION_KEY, passphrase);
        else sessionStorage.removeItem(SESSION_KEY);
      } catch {
        // The vault remains usable in memory when session storage is unavailable.
      }
      setData(hydratedPayload);
      setStatus('unlocked');
      return true;
    } catch (unlockError) {
      revokeObjectUrls();
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Storage may be unavailable. */ }
      setData(null);
      setStatus('error');
      setError(
        unlockError instanceof DOMException && unlockError.name === 'OperationError'
          ? 'The access key is incorrect. Please try again.'
          : unlockError instanceof Error
            ? unlockError.message
            : 'Unable to unlock protected data.',
      );
      return false;
    } finally {
      unlockInProgressRef.current = false;
    }
  }, [revokeObjectUrls]);

  useEffect(() => {
    let rememberedKey: string | null = null;
    try { rememberedKey = sessionStorage.getItem(SESSION_KEY); } catch { /* Storage may be unavailable. */ }
    if (rememberedKey) void unlock(rememberedKey, true);
    return revokeObjectUrls;
  }, [revokeObjectUrls, unlock]);

  const value = useMemo(
    () => ({ status, data, error, unlock, lock }),
    [status, data, error, unlock, lock],
  );

  return <SecureDataContext.Provider value={value}>{children}</SecureDataContext.Provider>;
}

export function useSecureData(): SecureDataContextValue {
  const context = useContext(SecureDataContext);
  if (!context) throw new Error('useSecureData must be used within SecureDataProvider.');
  return context;
}
