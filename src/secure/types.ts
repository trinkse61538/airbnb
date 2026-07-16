export interface WifiCredential {
  id: string;
  apartment: string;
  wifiName: string | null;
  password?: string;
  note?: string;
}

export interface CheckInPhoto {
  url: string;
  caption: string;
  storagePath?: string;
}

export interface CheckInRecord {
  id: string;
  apartment: string;
  keyAddress?: string;
  keyMapUrl?: string;
  lockboxCode?: string;
  lockboxType?: string;
  instructions: string;
  photos: CheckInPhoto[];
  notes?: string;
}

export interface EncryptedAssetDescriptor {
  file: string;
  iv: string;
  mimeType: string;
}

export interface SecurePayload {
  wifi: WifiCredential[];
  checkin: CheckInRecord[];
  instructionsVi: Record<string, string[]>;
  instructionsEn: Record<string, string[]>;
  assets: Record<string, EncryptedAssetDescriptor>;
}

export interface SecureEnvelope {
  version: 1;
  kdf: {
    algorithm: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  data: {
    algorithm: 'AES-GCM';
    iv: string;
    ciphertext: string;
  };
}
