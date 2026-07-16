import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateSourceDir = process.env.PRIVATE_SOURCE_DIR
  ? path.resolve(process.env.PRIVATE_SOURCE_DIR)
  : path.resolve(projectRoot, '../apartment-private-data');
const passphrase = process.env.PWA_ACCESS_PASSPHRASE;
const outputDir = path.join(projectRoot, 'public', 'secure');
const dataFile = path.join(privateSourceDir, 'sensitive-data.json');
const imageDir = path.join(privateSourceDir, 'images');

if (!passphrase || passphrase.length < 16) {
  throw new Error('Set PWA_ACCESS_PASSPHRASE to a private key containing at least 16 characters.');
}
if (!fs.existsSync(dataFile)) throw new Error(`Missing private data file: ${dataFile}`);
if (!fs.existsSync(imageDir)) throw new Error(`Missing private image directory: ${imageDir}`);

const salt = crypto.randomBytes(16);
const iterations = 250_000;
const key = crypto.pbkdf2Sync(passphrase, salt, iterations, 32, 'sha256');

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final(), cipher.getAuthTag()]);
  return { iv, ciphertext };
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outputDir, 'assets'), { recursive: true });

const payload = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const assets = {};
const imageFiles = fs.readdirSync(imageDir)
  .filter(file => /\.(?:jpe?g|png|webp)$/i.test(file))
  .sort((a, b) => a.localeCompare(b));

for (const file of imageFiles) {
  const originalPath = path.join(imageDir, file);
  const { iv, ciphertext } = encrypt(fs.readFileSync(originalPath));
  const encryptedName = `${crypto.createHash('sha256').update(file).digest('hex').slice(0, 24)}.bin`;
  fs.writeFileSync(path.join(outputDir, 'assets', encryptedName), ciphertext);
  assets[`/assets/images/${file}`] = {
    file: `secure/assets/${encryptedName}`,
    iv: iv.toString('base64'),
    mimeType: file.toLowerCase().endsWith('.png')
      ? 'image/png'
      : file.toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg',
  };
}

const encryptedPayload = encrypt(Buffer.from(JSON.stringify({ ...payload, assets }), 'utf8'));
const envelope = {
  version: 1,
  kdf: {
    algorithm: 'PBKDF2',
    hash: 'SHA-256',
    iterations,
    salt: salt.toString('base64'),
  },
  data: {
    algorithm: 'AES-GCM',
    iv: encryptedPayload.iv.toString('base64'),
    ciphertext: encryptedPayload.ciphertext.toString('base64'),
  },
};

fs.writeFileSync(path.join(outputDir, 'secure-data.json'), `${JSON.stringify(envelope)}\n`, 'utf8');
console.log(JSON.stringify({ encryptedRecords: payload.checkin.length, encryptedImages: imageFiles.length }));
