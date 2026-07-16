# Apartment Control Center PWA

An installable React/Vite dashboard for apartment inventory, Wi-Fi credentials, cleaner reminders and guest check-in guides.

## Version 3 highlights

- Runs on GitHub Pages and the custom domain `airbnb.khaitringuyen.com`.
- Uses Firebase Authentication as the single sign-in step; the old daily vault key screen is removed.
- Stores apartment, Wi-Fi and instruction data in Cloud Firestore with real-time updates.
- Stores check-in photos in Cloud Storage for Firebase.
- Adds an in-app **Manage Data & Access** screen for apartment CRUD, photo uploads, JSON backups and user roles.
- Lets the primary admin add or remove users without editing GitHub or redeploying the website.
- Includes a one-time importer for the existing encrypted apartment package.
- Keeps the inventory spreadsheet private and requests read-only Google Sheets access.

## Initial access accounts

- Primary admin: `khaitri15@gmail.com`
- Editors:
  - `henrynguyenfw@gmail.com`
  - `trinkse61538@gmail.com`
  - `airbnbjvilla1225@gmail.com`
  - `nathantran7@hotmail.com`

The primary admin is also enforced in `firestore.rules` and `storage.rules`, so this account can bootstrap the access collection. Future accounts are managed inside the app.

## Local development

Requirements: Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Production checks:

```bash
npm run lint
npm run build
npm run preview
```

## Firebase setup

Use the Firebase project referenced by `firebase-applet-config.json`.

1. Enable Google in **Authentication → Sign-in method**.
2. Add both `trinkse61538.github.io` and `airbnb.khaitringuyen.com` under **Authentication → Settings → Authorised domains**.
3. Create a Cloud Firestore database in production mode.
4. Open Firestore **Rules**, paste `firestore.rules`, then publish.
5. Create the default Cloud Storage bucket.
6. Open Storage **Rules**, paste `storage.rules`, then publish.
7. When Firebase asks to allow Storage Rules to read Firestore access documents, approve the connection.

The same rules can be deployed with Firebase CLI after signing in:

```bash
firebase deploy --only firestore:rules,storage
```

## Deploy to GitHub Pages

1. Put the contents of this project at the repository root.
2. Keep the default branch named `main`.
3. Open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Push or upload the files. `.github/workflows/deploy-pages.yml` builds and publishes `dist` automatically.
5. Keep the custom domain set to `airbnb.khaitringuyen.com` and enable **Enforce HTTPS**.

Important dot-prefixed files:

- `.github/workflows/deploy-pages.yml`
- `.gitignore`
- `.firebaserc`
- `public/.nojekyll`

## First run and one-time migration

1. Sign in at `https://airbnb.khaitringuyen.com` as `khaitri15@gmail.com`.
2. The app creates the initial access documents automatically.
3. Open **Manage Data & Access**.
4. If Firestore has no apartments yet, enter the previous private access key in **Import existing data**.
5. Wait until the import reaches 100%. Existing Wi-Fi, check-in instructions and photos are uploaded to Firebase.
6. After import, the previous access key is no longer required for normal use.

The encrypted files in `public/secure/` remain only as a one-time migration source. Do not delete them until migration has completed successfully.

## Day-to-day updates

Open **Manage Data & Access** to:

- add, edit or delete an apartment;
- update Wi-Fi name/password and notes;
- update lockbox details and bilingual instruction steps;
- add, caption or remove check-in photos;
- export a JSON backup;
- add users and choose Viewer, Editor or Admin roles.

All content changes are saved directly to Firebase and do not require a GitHub deployment.

## Google Sheets inventory

The inventory spreadsheet is read through Google OAuth. A user must have permission to view the sheet and grant the read-only Sheets scope. The OAuth access token stays in memory, so reconnecting Sheets may be required after restarting the browser even though Firebase app sign-in remains active.

## Security notes

- GitHub Pages is public, but Firestore and Storage data are restricted by Firebase rules to the access list.
- Do not commit the plaintext private data ZIP or previous access key.
- A Hotmail address can use the Google button only when that address is registered as a Google Account. Microsoft sign-in can be added later if needed.
- Keep `khaitri15@gmail.com` under your control because it is the permanent bootstrap admin in the included rules.

