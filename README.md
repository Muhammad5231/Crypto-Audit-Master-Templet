# Crypto Audit Master

Next.js + Prisma + SQLite based crypto audit app for uploading exchange CSV files, generating reports, and exporting summaries.

## Requirements

- Node.js 20+ recommended
- npm 10+ recommended
- Bun is optional

## Local Setup

### 1. Install dependencies

```powershell
npm install
```

### 2. Create environment file

Copy `.env.example` to `.env`.

Example:

```env
DATABASE_URL="file:../db/custom.db"
JWT_SECRET="change-me-before-production"
```

Important:

- `DATABASE_URL` must point to `../db/custom.db` because `prisma/schema.prisma` lives inside the `prisma` folder.
- The currently checked-in `.env` may contain a machine-specific Linux path. Replace it with the value above for local setup.

### 3. Prepare Prisma

```powershell
npx prisma generate
npx prisma db push
```

This project already contains `db/custom.db`. `prisma db push` will sync the schema with that SQLite database.

### 4. Start the app

```powershell
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Windows Notes

The default scripts are now Windows-friendly:

```powershell
npm run dev
npm run build
npm run start
```

Unix-specific standalone scripts are still available if you need the old flow:

```powershell
npm run dev:unix
npm run build:standalone
npm run start:standalone
```

## npm Troubleshooting

If `npx` or `npm install` fails with `ECOMPROMISED`, `offline=true`, or tries to use proxy `127.0.0.1:9`, clear those environment variables in PowerShell before installing:

```powershell
Remove-Item Env:NPM_CONFIG_OFFLINE -ErrorAction SilentlyContinue
Remove-Item Env:HTTP_PROXY -ErrorAction SilentlyContinue
Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue
Remove-Item Env:ALL_PROXY -ErrorAction SilentlyContinue
Remove-Item Env:GIT_HTTP_PROXY -ErrorAction SilentlyContinue
Remove-Item Env:GIT_HTTPS_PROXY -ErrorAction SilentlyContinue
```

If npm cache permissions fail on `AppData`, use a local cache directory:

```powershell
npm install --cache C:\tmp\crypto-audit-npm-cache
```

If a previous install failed midway, clean the partial install before retrying:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

If those variables keep coming back in every new terminal, remove the persistent user-level values:

```powershell
[Environment]::SetEnvironmentVariable("NPM_CONFIG_OFFLINE", $null, "User")
[Environment]::SetEnvironmentVariable("HTTP_PROXY", $null, "User")
[Environment]::SetEnvironmentVariable("HTTPS_PROXY", $null, "User")
[Environment]::SetEnvironmentVariable("ALL_PROXY", $null, "User")
[Environment]::SetEnvironmentVariable("GIT_HTTP_PROXY", $null, "User")
[Environment]::SetEnvironmentVariable("GIT_HTTPS_PROXY", $null, "User")
```

## PDF Export Note

To keep Windows setup lightweight, server-side PDF exports no longer require the native `canvas` package. The PDF report still works, but its performance charts are replaced with a fallback note in environments where native chart rendering is unavailable.

## First Use

1. Open the app in the browser.
2. Register a new account from the login/register screen.
3. Create a workspace.
4. Upload a CSV file from the Upload page.
5. Review generated report data and use exports as needed.

## Useful Commands

```powershell
npx prisma studio
npx prisma generate
npx prisma db push
npx next build
```

## Production Note

The app is configured with `output: "standalone"` in `next.config.ts`, but the existing production scripts are Unix-oriented. For a Windows local dev setup, the development command is the easiest path.
