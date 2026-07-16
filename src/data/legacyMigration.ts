import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import type { SecureEnvelope, SecurePayload } from '../secure/types';
import { publicUrl } from '../utils/publicUrl';
import { normalizeEmail } from './accessConfig';

interface LegacyVault {
  payload: SecurePayload;
  assetBlobs: Record<string, Blob>;
}

const WIFI_ID_ALIASES: Record<string, string> = {
  bathurst: 'bathurst-1306',
  'little-mount': 'little-mount-55',
  murray: 'murray-805',
};

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
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

function isSecurePayload(value: unknown): value is SecurePayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<SecurePayload>;
  return Array.isArray(payload.wifi)
    && Array.isArray(payload.checkin)
    && Boolean(payload.instructionsVi)
    && Boolean(payload.instructionsEn)
    && Boolean(payload.assets);
}

async function decryptLegacyVault(passphrase: string): Promise<LegacyVault> {
  const response = await fetch(publicUrl('secure/secure-data.json'));
  if (!response.ok) throw new Error('The existing encrypted data package could not be found.');
  const envelope = await response.json() as SecureEnvelope;
  const key = await deriveKey(passphrase, envelope);
  const decryptedPayload = await decryptBytes(
    key,
    base64ToBytes(envelope.data.ciphertext).buffer,
    envelope.data.iv,
  );
  const parsed: unknown = JSON.parse(new TextDecoder().decode(decryptedPayload));
  if (!isSecurePayload(parsed)) throw new Error('The existing data package has an unsupported format.');

  const assetBlobs: Record<string, Blob> = {};
  for (const [originalUrl, descriptor] of Object.entries(parsed.assets)) {
    const assetResponse = await fetch(publicUrl(descriptor.file));
    if (!assetResponse.ok) throw new Error('One of the existing check-in photos could not be loaded.');
    const decryptedAsset = await decryptBytes(key, await assetResponse.arrayBuffer(), descriptor.iv);
    assetBlobs[originalUrl] = new Blob([decryptedAsset], { type: descriptor.mimeType });
  }

  return { payload: parsed, assetBlobs };
}

function extensionForBlob(blob: Blob): string {
  if (blob.type.includes('png')) return 'png';
  if (blob.type.includes('webp')) return 'webp';
  if (blob.type.includes('gif')) return 'gif';
  return 'jpg';
}

export async function migrateLegacyData(
  passphrase: string,
  actorEmail: string,
  onProgress: (message: string, percent: number) => void,
): Promise<number> {
  if (!passphrase.trim()) throw new Error('Enter the previous access key once to import the existing data.');
  onProgress('Decrypting the existing apartment package…', 3);

  let vault: LegacyVault;
  try {
    vault = await decryptLegacyVault(passphrase);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'OperationError') {
      throw new Error('The previous access key is incorrect.');
    }
    throw error;
  }

  const wifiById = new Map(
    vault.payload.wifi.map(wifi => [WIFI_ID_ALIASES[wifi.id] || wifi.id, wifi]),
  );
  const checkinById = new Map(vault.payload.checkin.map(checkin => [checkin.id, checkin]));
  const apartmentIds = [...new Set([...wifiById.keys(), ...checkinById.keys()])].sort();
  const totalPhotos = vault.payload.checkin.reduce((sum, record) => sum + record.photos.length, 0);
  const totalOperations = Math.max(1, totalPhotos + apartmentIds.length);
  let completedOperations = 0;

  for (const apartmentId of apartmentIds) {
    const wifi = wifiById.get(apartmentId);
    const checkin = checkinById.get(apartmentId);
    const storedPhotos = [];

    if (checkin) {
      for (let index = 0; index < checkin.photos.length; index += 1) {
        const photo = checkin.photos[index];
        const blob = vault.assetBlobs[photo.url];
        if (!blob) continue;
        const storagePath = `apartment-media/${apartmentId}/legacy-${index + 1}.${extensionForBlob(blob)}`;
        onProgress(
          `Uploading check-in photo ${completedOperations + 1} of ${totalOperations}…`,
          Math.round(5 + (completedOperations / totalOperations) * 90),
        );
        await uploadBytes(ref(storage, storagePath), blob, { contentType: blob.type || 'image/jpeg' });
        storedPhotos.push({ storagePath, caption: photo.caption || '' });
        completedOperations += 1;
      }
    }

    const sourceInstructionId = checkin?.id || apartmentId;
    await setDoc(doc(db, 'apartments', apartmentId), {
      apartment: checkin?.apartment || wifi?.apartment || apartmentId,
      wifiName: wifi?.wifiName || '',
      password: wifi?.password || '',
      wifiNote: wifi?.note || '',
      keyAddress: checkin?.keyAddress || '',
      keyMapUrl: checkin?.keyMapUrl || '',
      lockboxCode: checkin?.lockboxCode || '',
      lockboxType: checkin?.lockboxType || '',
      instructions: checkin?.instructions || '',
      instructionsVi: vault.payload.instructionsVi[sourceInstructionId] || [],
      instructionsEn: vault.payload.instructionsEn[sourceInstructionId] || [],
      photos: storedPhotos,
      notes: checkin?.notes || '',
      migratedFromLegacyVault: true,
      updatedAt: serverTimestamp(),
      updatedBy: normalizeEmail(actorEmail),
    }, { merge: true });
    completedOperations += 1;
  }

  onProgress(`Imported ${apartmentIds.length} apartments successfully.`, 100);
  return apartmentIds.length;
}

