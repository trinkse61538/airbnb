export type AccessRole = 'admin' | 'editor' | 'viewer';

export interface AccessAccount {
  email: string;
  role: AccessRole;
  active: boolean;
  displayName?: string;
}

export interface ManagedPhoto {
  storagePath: string;
  caption: string;
  url?: string;
}

export interface ManagedApartment {
  id: string;
  apartment: string;
  wifiName: string;
  password: string;
  wifiNote: string;
  keyAddress: string;
  keyMapUrl: string;
  lockboxCode: string;
  lockboxType: string;
  instructions: string;
  instructionsVi: string[];
  instructionsEn: string[];
  photos: ManagedPhoto[];
  notes: string;
}

export type ApartmentDataStatus =
  | 'signed-out'
  | 'checking-access'
  | 'unauthorized'
  | 'loading'
  | 'ready'
  | 'error';

