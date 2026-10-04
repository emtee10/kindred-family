# Kindred

A calm, read-only family archive built with Next.js App Router, React, and TypeScript. Start with a person, follow their closest connections, discover ancestors and descendants, or trace the relationship between two people. The repository owner maintains the records in ordinary JSON.

**[Read the complete data schema and editing guide →](docs/DATA_SCHEMA.md)**

## What works in V1

- Responsive home screen with search across current, birth, former, alternate, and nickname entries.
- Immediate-family, bounded ancestor, bounded descendant, and shortest relationship-path views.
- Pan, zoom, touch controls, keyboard navigation, and a companion list of graph people.
- Structured profiles, life events, name changes, optional portraits, and initials for missing photos.
- Accessible uncertainty badges and labeled dashed relationship edges.
- Partial, approximate, before/after, and range dates without timezone shifts.
- Runtime validation with actionable record-specific errors.
- Cycle-safe traversal and conservative biological kinship labels.
- Shared-password login and logout, with server-side protection for family records and photos.

Auth.js / NextAuth Credentials authentication provides a stateless session lasting approximately seven days. There are no user accounts, database, external fonts, or genealogy services. Search and graph exploration run in the browser after authenticated data loading; authentication and private-file access require the Next.js server.

## Run locally

Requires Node.js 22.12+ (the development container uses Node 22).

```sh
npm ci
cp .env.example .env.local
```

Edit `.env.local` in the repository root:

```dotenv
FAMILY_PASSWORD=<shared password>
AUTH_SECRET=<random application secret>
FAMILY_DATA_PROVIDER=local
```

Generate a suitable random `AUTH_SECRET` with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Use a strong shared password and keep both values private. `.env.local` is ignored by Git; `.env.example` contains empty secret placeholders and selects the local provider by default. Neither secret may use a `NEXT_PUBLIC_` prefix or be imported into browser code.

```sh
npm run dev
```

Open `http://localhost:3000`, enter the shared password at `/login`, and explore the fictional starter archive.

```sh
npm test          # domain, validation, providers, and independent API authentication tests
npm run typecheck # TypeScript check
npm run build     # production Next.js build, including TypeScript validation
npm run start     # serve the production build locally on port 3000
npm run test:security # build and run production HTTP security tests on port 3107
```

Stop the development server before starting the production server on the same port. `npm run preview` is an alias for `npm run start` and also requires a prior production build. `npm run test:security` (also available as `npm run test:e2e`) uses Playwright HTTP requests and requires no browser download. It uses the production Webpack builder with a bounded Node.js heap to fit small dev containers, starts its own server on `127.0.0.1:3107`, forces the local provider and overrides local authentication values with a test-only password and a random test secret, and stops the server afterward. Keep that port free. Run it against the synthetic starter dataset in a local or CI workspace; it does not target a deployed archive. It regenerates `.next/`, so avoid running it alongside development/build processes in the same workspace.

### VS Code Dev Container

Open the folder in VS Code with the Dev Containers extension and choose **Reopen in Container**. `.devcontainer/devcontainer.json` uses the standard Microsoft Node 22 image, installs dependencies on creation, and forwards port 3000. Create `.env.local` as above, then run `npm run dev` in the container terminal. No custom Docker image is needed.

## Architecture and data

`src/domain/` holds the genealogy types, Zod runtime schemas, validation, name/date formatting, relationship traversal, and kinship logic. It remains independent of Next.js, React, and React Flow. React components transform domain records into React Flow nodes/edges. Immediate family uses a compact three-row layout; ancestors, descendants, and paths use ELK automatic layout. Graph positions are never stored in family data.

| Location | Purpose |
| --- | --- |
| `src/app/` | App Router pages, layout, login form, and API route handlers |
| `src/auth.ts` | Auth.js Credentials provider and seven-day JWT session configuration |
| `src/proxy.ts` | Redirects unauthenticated page requests and rejects protected API requests |
| `src/server/family-data.ts` | Server-only adapter from the family-data API to the selected provider |
| `src/server/providers/` | Server-only `FamilyDataProvider` contract, selector, local/Blob implementations, and shared validation |
| `src/server/photos.ts` | Server-only adapter from the photo API to the selected provider |
| `src/app/FamilyClient.tsx` | Fetches authenticated records and initializes the existing React app |
| `src/App.tsx`, `src/components/`, `src/styles.css` | Existing exploration UI, graph rendering, and styling |
| `src/data/types.ts` | Shared archive types; contains no family records |
| `private-data/people.json` | Stable person IDs, names, life facts, nested events, and portrait references |
| `private-data/relationships.json` | Directed parent/guardian records and symmetric spouse/partner connections |
| `private-data/config.ts` | Server-only title, subtitle, demo flag, and featured person IDs |
| `private-media/` | Private portrait files; starter data has none |
| `next.config.ts` | Next.js configuration and runtime tracing for private JSON and media |

After login, `FamilyClient` fetches `/api/family-data`. That route independently checks the Auth.js session, uses the selected provider to load and validate records on the server, and returns records and archive configuration with `Cache-Control: private, no-store`. The client validates the received records and initializes the existing genealogy model. Private JSON and configuration are never imported into Client Components or browser bundles.

Portraits use `/api/photos/[...filename]`, including nested relative paths. The photo route independently checks authentication, accepts supported image filenames, rejects unsafe paths, checks resolved filesystem containment for local files, and returns 404 for missing or invalid files. Photo responses use `Cache-Control: private, no-store`.

`FamilyDataProvider` supplies validated archive records/configuration and photo bytes. `FAMILY_DATA_PROVIDER=local|blob` selects it on the server; an unset variable preserves the local default, and any other value is rejected. The contract, selector, implementations, and shared validation all import `server-only`. No provider, storage credential, Blob URL, or SDK metadata is passed to Client Components. Both storage models use the existing API contracts and genealogy schemas.

The demonstration has 26 entirely fictional people across five generations, with invented places and details. It includes half-siblings, remarriage, an unmarried couple, adoption, step-parents, guardianship, uncertain parentage, changed names, incomplete records, and deceased people. Connected branches and partnership edges form cycles that exercise traversal. It is ready to explore after cloning and supplying local secrets.

See [the schema guide](docs/DATA_SCHEMA.md) for every field, editing examples, and traversal rules.

## Keep private family data separate

This public repository must only contain synthetic data. **A repository containing real family records, configuration, or photos must remain private**, along with its deployment workspace and build artifacts.

For `FAMILY_DATA_PROVIDER=local`, the simplest deployment setup is a private copy of the application repository. Replace the demonstration JSON in `private-data/`, place photographs in `private-media/`, and update `private-data/config.ts`, including setting `isDemo` to `false`. The app falls back to available people if the featured IDs are absent. Keep portrait `file` values relative to `private-media/`, for example `portraits/p0012.webp`.

For local-file deployment using separate code and data repositories, assemble them in a private deployment workspace before building: copy records and configuration into `private-data/` and photographs into `private-media/`. Those files must be present when Vercel builds and traces the server functions. Never copy private records or photos into `public/`, and never publish the assembled workspace or server build artifacts.

For `FAMILY_DATA_PROVIDER=blob`, keep the application repository synthetic and store real records, configuration, and photos in a **Private** Blob store. Maintain the source files and upload workspace privately; the application loads real content at runtime, rather than copying it into its build workspace. See the Blob model below.

Avoid logging private records in public CI systems. Existing domain tests assert fictional starter examples; run them against the synthetic dataset before replacing it. Private records are validated by the server when an authenticated client loads the archive, and again by the client before rendering. A successful build alone does not validate replacement JSON.

## Deployment

### Local files on a Node.js server

Set `FAMILY_DATA_PROVIDER=local` (or leave it unset). On a private server with Node 22, install dependencies with `npm ci`, provide `FAMILY_PASSWORD` and `AUTH_SECRET` through the process environment or private `.env.local`, run `npm run build`, then `npm run start`. Run from the application root with `private-data/people.json`, `private-data/relationships.json`, `private-data/config.ts`, and `private-media/` available. The TypeScript archive configuration is compiled into server code; change it before building.

Use a process supervisor and an HTTPS reverse proxy for a persistent deployment. Do not configure a proxy or web server to serve private directories directly or publicly cache protected responses. The local provider needs no Blob credentials or storage service.

Next.js supports this [Node.js server deployment workflow](https://nextjs.org/docs/app/getting-started/deploying). This application requires server-side sessions and route handlers: serving a static directory or enabling `output: 'export'` cannot provide its privacy boundary. Hosting elsewhere requires support for the application's Next.js server features. The current routes and fetch URLs assume deployment at the domain root.

### Vercel project setup

1. Import the deployment repository into a Vercel project. Keep any repository containing real files private; Blob deployments can retain only synthetic files in the application repository.
2. Select **Next.js**, **Node.js 22.x**, install with `npm ci`, and build with `npm run build`. Leave the Output Directory at the framework default.
3. Set `FAMILY_PASSWORD`, `AUTH_SECRET`, and `FAMILY_DATA_PROVIDER` in **Settings → Environment Variables** for each intended environment. Restrict private archive access to intended Production/Preview deployments.
4. Configure one storage model below, then deploy over HTTPS. Environment or code changes require redeployment.
5. Run the access checks below against the deployment. Check an actual protected photograph if media is present.

See Vercel's [environment variable guide](https://vercel.com/docs/environment-variables) and [supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

#### Local files packaged on Vercel

Set `FAMILY_DATA_PROVIDER=local` and include `private-data/` and `private-media/` in the private deployment root before building. `next.config.ts` traces `private-data/**/*.json` into the family-data function and `private-media/**/*` into the photo function. Archive configuration is compiled from `private-data/config.ts`. Updating local files or configuration requires rebuilding and redeploying. No Blob store is needed.

#### Vercel Private Blob

Set `FAMILY_DATA_PROVIDER=blob`. Create a Blob store with **Private** access and connect it to the project and intended environments. The SDK can use Vercel-managed OIDC with the connected `BLOB_STORE_ID`; let Vercel manage `VERCEL_OIDC_TOKEN`. For local or other Node.js hosting using Blob, supply the store's private `BLOB_READ_WRITE_TOKEN` in the server environment instead. These credentials must never use `NEXT_PUBLIC_` or appear in browser code. See the [Blob authentication guide](https://vercel.com/docs/vercel-blob/using-blob-sdk#authentication).

Upload objects at these exact pathnames:

| Private Blob pathname | Content |
| --- | --- |
| `private-data/people.json` | Existing person-array schema |
| `private-data/relationships.json` | Existing relationship-array schema |
| `private-data/config.json` | Archive configuration as JSON, with the same fields as the local TypeScript configuration |
| `private-media/<file>` | Portrait bytes; `<file>` is the existing relative photo `file` value, including nested directories |

For example, `private-data/config.json` can contain:

```json
{
  "title": "Kindred",
  "subtitle": "A little closer to your roots.",
  "isDemo": false,
  "featured": ["p0012"]
}
```

Use person IDs from your records. Blob configuration is JSON data, never executable TypeScript. It is loaded and validated at runtime; the local `config.ts` is not used by the Blob provider.

Use the dashboard or a trusted server-side upload script. Keep pathnames stable when using the SDK by setting `addRandomSuffix: false`; do not upload to a Public store. The following example runs in a private maintenance workspace containing the application dependencies, `.env.local` with Blob credentials, and source files (including a JSON configuration you prepare separately):

```sh
node --env-file=.env.local --input-type=module <<'JS'
import { readFile, readdir } from 'node:fs/promises';
import { put } from '@vercel/blob';

async function upload(pathname) {
  await put(pathname, await readFile(pathname), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true,
  });
}
for (const name of ['people.json', 'relationships.json', 'config.json']) {
  await upload(`private-data/${name}`);
}
async function uploadPhotos(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const pathname = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await uploadPhotos(pathname);
    else if (entry.isFile() && /\.(jpe?g|png|webp|avif)$/i.test(entry.name)) await upload(pathname);
  }
}
await uploadPhotos('private-media');
JS
```

This overwrites the specified objects. The application exposes no upload endpoint. See the [SDK upload guide](https://vercel.com/docs/vercel-blob/using-blob-sdk#upload-a-blob) for maintenance operations.

Reads use `access: 'private'` and bypass the Blob content cache. Updating objects does not require an application redeploy; already-open clients keep their loaded records until refreshed. The three JSON objects are read separately, so keep their IDs/configuration consistent during updates. Missing required JSON or storage failures produce the existing authenticated family-data error response; missing photos return 404. Blob errors never fall back to local demonstration data. An unconfigured or Public store is not a supported substitute.

The browser receives bytes only through `/api/family-data` and `/api/photos/[...filename]`, after the existing Auth.js checks. It receives no Blob credentials, storage URLs, redirects, or signed download links. Both routes retain `Cache-Control: private, no-store`. See [Private Blob storage](https://vercel.com/docs/vercel-blob/private-storage) for the storage access model. No database or user accounts are introduced.

## Security model

- A visitor without a valid Auth.js session is redirected to `/login` for protected pages. Protected API requests return 401.
- The root page and private API routes verify authentication independently of `src/proxy.ts`.
- Password comparison uses fixed-length SHA-256 digests and a timing-safe comparison; Auth.js manages session-cookie cryptography.
- Provider code and Blob credentials remain server-only. Private Blob stores require storage authentication in addition to the application session boundary.
- Family JSON and photos must never be moved into `public/`, exposed through a static-file server, or imported into Client Components. `public/` is reserved for non-sensitive assets; its leftover empty `photos/` directory is not used for portraits.
- Anyone given the shared password should be assumed capable of downloading the entire family dataset and available photos. This provides shared-password access, with no individual authorization or audit identity.
- Changing the shared password cannot selectively revoke one family member. Existing sessions do not recheck the password on every request.
- Logout clears the current browser's session cookie. Stateless sessions do not provide individual server-side token revocation.

If the shared password may be compromised:

1. Change `FAMILY_PASSWORD`.
2. Generate and set a new `AUTH_SECRET` to invalidate existing sessions.
3. Redeploy every affected deployment, including any retained private preview deployments, or remove their access.

Rotating `AUTH_SECRET` invalidates sessions on deployments using the new secret. Previously downloaded records and photos cannot be recalled.

### Access checks before sharing a deployment

Run `npm test`, `npm run typecheck`, and `npm run test:security`. The security command includes a fresh production build and tests each current `private-data/` file, alternate URLs, protected APIs, missing/forged sessions, invalid passwords, login/session persistence/logout, and browser bundles. Provider tests in `npm test` use real local files and a mocked Blob SDK to verify validation, private-read options, unsafe paths, missing objects, and credential-error handling. No live Blob store is accessed by automated tests. Route-level tests also check that unauthenticated calls are rejected before private files are read, independently of Proxy.

For manual deployment checks, run `npm run build` and start the production server. Verify the following while logged out, without following redirects:

```sh
curl -i http://localhost:3000/
curl -i http://localhost:3000/api/family-data
curl -i http://localhost:3000/api/photos/example.jpg
curl -i http://localhost:3000/private-data/people.json
curl -i http://localhost:3000/people.json
curl -i http://localhost:3000/data/people.json
```

The root should redirect to `/login`; both API requests should return 401; all three direct JSON paths should return 404. Substitute your HTTPS deployment origin for the local origin when checking hosting.

In the browser, verify wrong-password rejection, successful login, refresh with a valid session, all exploration views at desktop/mobile widths, and logout followed by rejected private API requests. Authenticated data and photo responses should have `Cache-Control: private, no-store`; a missing photo should return 404 after login. Inspect `.next/static/` JavaScript for distinctive dataset values to check that records were not embedded in browser bundles. The automated security suite checks HTTP authentication and file-access behavior; desktop/mobile UI behavior still requires browser verification.

## Status and limits

V1 focuses on a small family archive (tens to a few hundred people). Ancestor/descendant views are limited to 2–5 generations and show repeated ancestors once. Paths show one shortest route across all connection types. Kinship terms are only emitted for routes whose biological meaning is clear; paths through adoption, step relationships, guardians, marriage, uncertain parentage, and ambiguous half-siblings retain explicit relationship labels. Spouse records are historical connections without start/end status; divorce events provide context.

No editing, individual accounts, source management, GEDCOM, maps, research integrations, or arbitrary event types are included. Future work could add richer partnership dates and source provenance, additional kinship descriptions, and shareable exploration links.

## Contributing

Keep the domain independent of frameworks and rendering, use fictional data in contributions, and update the schema guide whenever records change. Run `npm test`, `npm run typecheck`, and `npm run test:security` before submitting a change; verify primary flows at desktop and mobile sizes and preserve authenticated data boundaries. Avoid adding services or infrastructure for features outside [the project scope](docs/PROJECT_SCOPE.md).
