# GitHub OAuth setup

GitHub sign-in and public repository browsing do not request private-repository access. Selecting **Enable private repositories** starts a second authorization flow for GitHub's `repo` permission. That OAuth permission can read and write repositories available to the account; DevVault uses the grant to list repositories and read source for the features the user requests. A GitHub App is a better fit if the product later needs repository-level, read-only permissions.

The OAuth flow uses a server-side callback, a signed, short-lived state cookie, PKCE S256, and DevVault's existing one-hour JWT session. Sign-in requests `read:user user:email`. The private-repository flow also requests `repo offline_access`; refresh tokens are rotated and encrypted before storage.

GitHub's stable numeric user ID is the stored identity key. A verified GitHub email can link to exactly one existing DevVault account; ambiguous or already-linked email matches are rejected. New GitHub-only accounts without a usable verified email receive an internal `users.devvault.invalid` address and continue to sign in with GitHub. Existing users can connect GitHub from the dashboard after signing in with email and password.

## Create the OAuth App

In GitHub, open **Settings → Developer settings → OAuth Apps → New OAuth App** and use:

- Application name: `DevVault AI`
- Homepage URL: `https://devvault-orpin-nu.vercel.app`
- Authorization callback URL: `https://devvault-api-3dle.onrender.com/api/auth/github/callback`

For local development, use a separate OAuth App (or add the local callback if your app settings allow multiple callbacks):

- Homepage URL: `http://localhost:5173`
- Callback URL: `http://localhost:5000/api/auth/github/callback`

Keep the GitHub client secret only in the backend environment. Never add it to `client/.env` or any `VITE_*` variable.

## Backend environment

Set these in Render for the production backend, and in the local server `.env` for development:

```dotenv
GITHUB_CLIENT_ID=<OAuth App client ID>
GITHUB_CLIENT_SECRET=<OAuth App client secret>
GITHUB_CALLBACK_URL=https://devvault-api-3dle.onrender.com/api/auth/github/callback
GITHUB_TOKEN_ENCRYPTION_KEY=<base64 encoded 32-byte key>
CLIENT_URL=https://devvault-orpin-nu.vercel.app
```

Generate the encryption key with `openssl rand -base64 32`. Use a different key per environment and keep a protected backup: losing it makes stored private-access tokens unreadable, and changing it requires users to authorize private access again. Preserve existing `JWT_SECRET`, database, and Gemini variables. Local development uses the localhost callback and `CLIENT_URL=http://localhost:5173`.

For Vercel, set only the frontend API URL:

```dotenv
VITE_API_URL=https://devvault-api-3dle.onrender.com/api
```

No OAuth secret or GitHub token belongs in Vercel. After changing the production environment, redeploy the relevant service yourself.

## Database change awaiting approval

OAuth identities and encrypted expiring tokens require columns on `users`. The exact proposed SQL is in [`20261014_github_identity_and_private_access.sql`](../database/migrations/20261014_github_identity_and_private_access.sql). It has not been applied. Until that migration is approved and applied, OAuth routes report setup required and existing email/password authentication continues to work.

The UI removes the stored private-access token when **Remove private access** is selected. To revoke GitHub's OAuth authorization itself, open GitHub **Settings → Applications → Authorized OAuth Apps → DevVault AI** and revoke it there.
