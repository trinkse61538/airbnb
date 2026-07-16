# Apartment Control Center PWA

An installable, offline-friendly React/Vite dashboard for apartment inventory, cleaner reminders, Wi-Fi credentials and guest check-in guides.

## What changed in the GitHub Pages edition

- Runs as a fully static site: no Express server or `/api` endpoint is required.
- Works from both a custom domain and a GitHub Pages `/repository-name/` path.
- Includes a web app manifest, service worker, install prompt, offline app shell and cached inventory snapshot.
- Deploys automatically with GitHub Actions.
- Keeps Wi-Fi passwords, lockbox codes, guest instructions and check-in photos out of the public source bundle.
- Encrypts the protected apartment vault with PBKDF2 + AES-256-GCM. It is decrypted only after the private access key is entered in the browser.
- Keeps Google Sheets OAuth access tokens in memory instead of browser storage.

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

## Deploy to GitHub Pages

1. Create a GitHub repository and put the contents of this project at the repository root.
2. Make sure the default branch is named `main`.
3. Open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Push or upload the files. The workflow in `.github/workflows/deploy-pages.yml` builds and publishes the `dist` directory automatically.
5. Open the deployment URL shown by the **Deploy PWA to GitHub Pages** action.

Important hidden files and folders:

- `.github/workflows/deploy-pages.yml` controls deployment.
- `.gitignore` prevents private material and local builds from being committed.
- `public/.nojekyll` is copied into the published site.

When uploading through GitHub's web interface, verify that these dot-prefixed files are present after the upload.

## Enable Google sign-in on the deployed domain

The app reads the inventory spreadsheet through Google OAuth. In the Firebase project referenced by `firebase-applet-config.json`:

1. Open **Firebase Console → Authentication → Settings → Authorized domains**.
2. Add `YOUR_GITHUB_USERNAME.github.io`.
3. If a custom domain is used, add that domain as well.
4. Confirm that the Google provider is enabled in **Authentication → Sign-in method**.

The inventory spreadsheet can remain private. A user must have permission to view it and grant the read-only Google Sheets scope when signing in.

Inventory parsing expects product headings on row 3 of each apartment tab and treats the latest non-empty row as the current status.

## Install on a phone

- Android Chrome: open the deployed URL and use **Install app** or **Add to Home screen**.
- iPhone/iPad: open the URL in Safari, tap **Share**, then **Add to Home Screen**.

After the protected vault has been opened once while online, the app shell, encrypted apartment vault and latest successfully synced inventory snapshot remain available offline on that device.

## Protected apartment data

Only `public/secure/` is deployed. Its payload and images are encrypted. The unencrypted source package and the private access key must never be committed to GitHub, shared in a public message or placed in the project directory.

To regenerate the encrypted vault after editing the separate private data package:

```bash
PWA_ACCESS_PASSPHRASE="your-existing-private-key" \
PRIVATE_SOURCE_DIR="/absolute/path/to/apartment-private-data" \
npm run encrypt-data
```

Commit only the newly generated files inside `public/secure/`. Anyone using the old access key will be able to unlock the updated package when the same key is used to regenerate it.

If the access key is lost, the encrypted package cannot be recovered. Keep the private source package and key in a password manager or another secure location.

## Security notes

- GitHub Pages is publicly reachable. The encryption layer protects the embedded credentials, but access-key distribution is still your responsibility.
- Do not place Telegram tokens, webhook URLs or other credentials directly in source files.
- The dashboard stores notification channel settings locally on the current device. Avoid configuring them on a shared computer.
- Use a private Google Sheet and grant access only to the people who need inventory synchronization.
