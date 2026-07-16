import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { db, storage } from '../firebase';
import { PRIMARY_ADMIN_EMAIL, normalizeEmail } from './accessConfig';
import type { AccessRole, ManagedApartment, ManagedPhoto } from './types';

export interface PendingPhotoUpload {
  file: File | Blob;
  caption: string;
  fileName?: string;
}

function cleanFileName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'image.jpg';
}

export function makeApartmentId(name: string, existingIds: string[]): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'apartment';

  if (!existingIds.includes(base)) return base;
  let suffix = 2;
  while (existingIds.includes(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function saveManagedApartment(
  apartment: ManagedApartment,
  newPhotos: PendingPhotoUpload[],
  removedStoragePaths: string[],
  actorEmail: string,
): Promise<void> {
  if (!apartment.id) throw new Error('Apartment ID is required.');
  if (!apartment.apartment.trim()) throw new Error('Apartment name is required.');

  const uploadedPhotos: ManagedPhoto[] = [];
  for (const pendingPhoto of newPhotos) {
    const sourceName = pendingPhoto.fileName
      || (pendingPhoto.file instanceof File ? pendingPhoto.file.name : 'image.jpg');
    const storagePath = `apartment-media/${apartment.id}/${crypto.randomUUID()}-${cleanFileName(sourceName)}`;
    await uploadBytes(ref(storage, storagePath), pendingPhoto.file, {
      contentType: pendingPhoto.file.type || 'image/jpeg',
      customMetadata: { apartmentId: apartment.id },
    });
    uploadedPhotos.push({ storagePath, caption: pendingPhoto.caption.trim() });
  }

  const photos = [
    ...apartment.photos.map(photo => ({
      storagePath: photo.storagePath,
      caption: photo.caption.trim(),
    })),
    ...uploadedPhotos,
  ].filter(photo => photo.storagePath);

  await setDoc(doc(db, 'apartments', apartment.id), {
    apartment: apartment.apartment.trim(),
    wifiName: apartment.wifiName.trim(),
    password: apartment.password,
    wifiNote: apartment.wifiNote.trim(),
    keyAddress: apartment.keyAddress.trim(),
    keyMapUrl: apartment.keyMapUrl.trim(),
    lockboxCode: apartment.lockboxCode.trim(),
    lockboxType: apartment.lockboxType.trim(),
    instructions: apartment.instructions.trim(),
    instructionsVi: apartment.instructionsVi.map(step => step.trim()).filter(Boolean),
    instructionsEn: apartment.instructionsEn.map(step => step.trim()).filter(Boolean),
    photos,
    notes: apartment.notes.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: normalizeEmail(actorEmail),
  }, { merge: true });

  await Promise.allSettled(
    removedStoragePaths.filter(Boolean).map(storagePath => deleteObject(ref(storage, storagePath))),
  );
}

export async function deleteManagedApartment(apartment: ManagedApartment): Promise<void> {
  await deleteDoc(doc(db, 'apartments', apartment.id));
  await Promise.allSettled(
    apartment.photos
      .map(photo => photo.storagePath)
      .filter(Boolean)
      .map(storagePath => deleteObject(ref(storage, storagePath))),
  );
}

export async function saveAccessAccount(email: string, role: AccessRole): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Please enter a valid email address.');
  }
  const enforcedRole = normalized === PRIMARY_ADMIN_EMAIL ? 'admin' : role;
  await setDoc(doc(db, 'access', normalized), {
    email: normalized,
    role: enforcedRole,
    active: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function removeAccessAccount(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (normalized === PRIMARY_ADMIN_EMAIL) {
    throw new Error('The primary admin account cannot be removed.');
  }
  await deleteDoc(doc(db, 'access', normalized));
}

