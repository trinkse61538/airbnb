import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getBlob, ref } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import type { SecurePayload } from '../secure/types';
import { INITIAL_ACCESS_ACCOUNTS, PRIMARY_ADMIN_EMAIL, normalizeEmail } from './accessConfig';
import type {
  AccessAccount,
  AccessRole,
  ApartmentDataStatus,
  ManagedApartment,
  ManagedPhoto,
} from './types';

interface ApartmentDataContextValue {
  status: ApartmentDataStatus;
  role: AccessRole | null;
  user: User | null;
  apartments: ManagedApartment[];
  accessAccounts: AccessAccount[];
  data: SecurePayload | null;
  error: string;
  canEdit: boolean;
  isAdmin: boolean;
}

const ApartmentDataContext = createContext<ApartmentDataContextValue | null>(null);

function emptyApartment(id: string, value: Partial<ManagedApartment>): ManagedApartment {
  return {
    id,
    apartment: value.apartment || '',
    wifiName: value.wifiName || '',
    password: value.password || '',
    wifiNote: value.wifiNote || '',
    keyAddress: value.keyAddress || '',
    keyMapUrl: value.keyMapUrl || '',
    lockboxCode: value.lockboxCode || '',
    lockboxType: value.lockboxType || '',
    instructions: value.instructions || '',
    instructionsVi: Array.isArray(value.instructionsVi) ? value.instructionsVi.filter(Boolean) : [],
    instructionsEn: Array.isArray(value.instructionsEn) ? value.instructionsEn.filter(Boolean) : [],
    photos: Array.isArray(value.photos)
      ? value.photos
          .filter(photo => photo && typeof photo.storagePath === 'string')
          .map(photo => ({
            storagePath: photo.storagePath,
            caption: photo.caption || '',
            url: photo.url || '',
          }))
      : [],
    notes: value.notes || '',
  };
}

function isRole(value: unknown): value is AccessRole {
  return value === 'admin' || value === 'editor' || value === 'viewer';
}

function friendlyFirebaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  const lowerMessage = message.toLocaleLowerCase();
  if (lowerMessage.includes('permission-denied') || lowerMessage.includes('missing or insufficient permissions')) {
    return 'Firebase denied access. Publish the Firestore and Storage rules included with this update, then reload the app.';
  }
  if (lowerMessage.includes('not-found') || lowerMessage.includes('does not exist')) {
    return 'Cloud Firestore is not ready yet. Create the Firestore database in Firebase Console, then reload the app.';
  }
  return message || 'Unable to load apartment data from Firebase.';
}

async function ensureInitialAccessAccounts() {
  for (const account of INITIAL_ACCESS_ACCOUNTS) {
    const normalized = normalizeEmail(account.email);
    const accountRef = doc(db, 'access', normalized);
    const existing = await getDoc(accountRef);
    if (!existing.exists()) {
      await setDoc(accountRef, {
        email: normalized,
        role: account.role,
        active: true,
        createdAt: serverTimestamp(),
        createdBy: PRIMARY_ADMIN_EMAIL,
        updatedAt: serverTimestamp(),
      });
    }
  }
}

function toSecurePayload(apartments: ManagedApartment[]): SecurePayload {
  const checkin = apartments
    .filter(apartment => Boolean(
      apartment.keyAddress
      || apartment.keyMapUrl
      || apartment.lockboxCode
      || apartment.lockboxType
      || apartment.instructions
      || apartment.instructionsVi.length
      || apartment.instructionsEn.length
      || apartment.photos.length
      || apartment.notes,
    ))
    .map(apartment => ({
      id: apartment.id,
      apartment: apartment.apartment,
      keyAddress: apartment.keyAddress,
      keyMapUrl: apartment.keyMapUrl,
      lockboxCode: apartment.lockboxCode,
      lockboxType: apartment.lockboxType,
      instructions: apartment.instructions,
      photos: apartment.photos.map(photo => ({
        url: photo.url || '',
        caption: photo.caption,
        storagePath: photo.storagePath,
      })),
      notes: apartment.notes,
    }));

  return {
    wifi: apartments
      .filter(apartment => Boolean(apartment.wifiName || apartment.password || apartment.wifiNote))
      .map(apartment => ({
        id: apartment.id,
        apartment: apartment.apartment,
        wifiName: apartment.wifiName || null,
        password: apartment.password,
        note: apartment.wifiNote,
      })),
    checkin,
    instructionsVi: Object.fromEntries(apartments.map(apartment => [apartment.id, apartment.instructionsVi])),
    instructionsEn: Object.fromEntries(apartments.map(apartment => [apartment.id, apartment.instructionsEn])),
    assets: {},
  };
}

export function ApartmentDataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [status, setStatus] = useState<ApartmentDataStatus>(auth.currentUser ? 'checking-access' : 'signed-out');
  const [role, setRole] = useState<AccessRole | null>(null);
  const [apartments, setApartments] = useState<ManagedApartment[]>([]);
  const [accessAccounts, setAccessAccounts] = useState<AccessAccount[]>([]);
  const [error, setError] = useState('');
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => auth.onAuthStateChanged(nextUser => {
    setUser(nextUser);
    setRole(null);
    setApartments([]);
    setAccessAccounts([]);
    setError('');
    setStatus(nextUser ? 'checking-access' : 'signed-out');
  }), []);

  useEffect(() => {
    if (!user?.email) return;
    const email = normalizeEmail(user.email);
    let active = true;
    let unsubscribeAccess = () => {};

    const checkAccess = async () => {
      try {
        if (email === PRIMARY_ADMIN_EMAIL) await ensureInitialAccessAccounts();
        if (!active) return;

        unsubscribeAccess = onSnapshot(
          doc(db, 'access', email),
          snapshot => {
            if (!active) return;
            const value = snapshot.data();
            const nextRole = email === PRIMARY_ADMIN_EMAIL
              ? 'admin'
              : value?.active !== false && isRole(value?.role)
                ? value.role
                : null;

            if ((!snapshot.exists() && email !== PRIMARY_ADMIN_EMAIL) || !nextRole) {
              setRole(null);
              setStatus('unauthorized');
              setError('');
              return;
            }

            setRole(previousRole => {
              setStatus(previousRole === nextRole ? 'ready' : 'loading');
              return nextRole;
            });
            setError('');
          },
          snapshotError => {
            if (!active) return;
            setStatus('error');
            setError(friendlyFirebaseError(snapshotError));
          },
        );
      } catch (accessError) {
        if (!active) return;
        setStatus('error');
        setError(friendlyFirebaseError(accessError));
      }
    };

    void checkAccess();
    return () => {
      active = false;
      unsubscribeAccess();
    };
  }, [user]);

  useEffect(() => {
    if (!user || !role) return;
    let active = true;
    let hydrationVersion = 0;

    const unsubscribeApartments = onSnapshot(
      collection(db, 'apartments'),
      snapshot => {
        if (!active) return;
        const version = ++hydrationVersion;
        const rawApartments = snapshot.docs
          .map(apartmentDoc => emptyApartment(apartmentDoc.id, apartmentDoc.data() as Partial<ManagedApartment>))
          .sort((first, second) => first.apartment.localeCompare(second.apartment));

        setApartments(rawApartments);
        setStatus('ready');
        setError('');

        const hydratePhotos = async () => {
          const hydrated = await Promise.all(rawApartments.map(async apartment => {
            const photos = await Promise.all(apartment.photos.map(async photo => {
              if (!photo.storagePath) return photo;
              const cachedUrl = objectUrlsRef.current.get(photo.storagePath);
              if (cachedUrl) return { ...photo, url: cachedUrl };
              try {
                const blob = await getBlob(ref(storage, photo.storagePath));
                const url = URL.createObjectURL(blob);
                objectUrlsRef.current.set(photo.storagePath, url);
                return { ...photo, url };
              } catch {
                return { ...photo, url: '' };
              }
            }));
            return { ...apartment, photos };
          }));

          if (active && version === hydrationVersion) setApartments(hydrated);
        };

        void hydratePhotos();
      },
      snapshotError => {
        if (!active) return;
        setStatus('error');
        setError(friendlyFirebaseError(snapshotError));
      },
    );

    return () => {
      active = false;
      unsubscribeApartments();
    };
  }, [role, user]);

  useEffect(() => {
    if (!user || role !== 'admin') {
      setAccessAccounts([]);
      return;
    }

    return onSnapshot(
      collection(db, 'access'),
      snapshot => {
        const accounts = snapshot.docs
          .map(accountDoc => {
            const value = accountDoc.data();
            return {
              email: normalizeEmail(value.email || accountDoc.id),
              role: isRole(value.role) ? value.role : 'viewer',
              active: value.active !== false,
              displayName: value.displayName || '',
            } satisfies AccessAccount;
          })
          .sort((first, second) => {
            if (first.email === PRIMARY_ADMIN_EMAIL) return -1;
            if (second.email === PRIMARY_ADMIN_EMAIL) return 1;
            return first.email.localeCompare(second.email);
          });
        setAccessAccounts(accounts);
      },
      snapshotError => setError(friendlyFirebaseError(snapshotError)),
    );
  }, [role, user]);

  useEffect(() => () => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, []);

  const data = useMemo(() => role ? toSecurePayload(apartments) : null, [apartments, role]);
  const value = useMemo<ApartmentDataContextValue>(() => ({
    status,
    role,
    user,
    apartments,
    accessAccounts,
    data,
    error,
    canEdit: role === 'admin' || role === 'editor',
    isAdmin: role === 'admin',
  }), [accessAccounts, apartments, data, error, role, status, user]);

  return <ApartmentDataContext.Provider value={value}>{children}</ApartmentDataContext.Provider>;
}

export function useApartmentData(): ApartmentDataContextValue {
  const context = useContext(ApartmentDataContext);
  if (!context) throw new Error('useApartmentData must be used within ApartmentDataProvider.');
  return context;
}

export function createEmptyApartment(id = ''): ManagedApartment {
  return emptyApartment(id, {});
}

export function withoutPhotoUrls(apartment: ManagedApartment): ManagedApartment {
  return {
    ...apartment,
    photos: apartment.photos.map(({ storagePath, caption }: ManagedPhoto) => ({ storagePath, caption })),
  };
}
