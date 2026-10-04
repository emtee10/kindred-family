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
```

Generate a suitable random `AUTH_SECRET` with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Use a strong shared password and keep both values private. `.env.local` is ignored by Git; `.env.example` contains empty variable names only. Neither secret may use a `NEXT_PUBLIC_` prefix or be imported into browser code.

```sh
npm run dev
```

Open `http://localhost:3000`, enter the shared password at `/login`, and explore the fictional starter archive.

```sh
npm test          # existing domain and validation tests
npm run typecheck # TypeScript check
npm run build     # production Next.js build, including TypeScript validation
npm run start     # serve the production build locally on port 3000
```

Stop the development server before starting the production server on the same port. `npm run preview` is an alias for `npm run start` and also requires a prior production build. The `test:e2e` script is present, but no Playwright test suite or configuration has been added yet.

### VS Code Dev Container

Open the folder in VS Code with the Dev Containers extension and choose **Reopen in Container**. `.devcontainer/devcontainer.json` uses the standard Microsoft Node 22 image, installs dependencies on creation, and forwards port 3000. Create `.env.local` as above, then run `npm run dev` in the container terminal. No custom Docker image is needed.

## Architecture and data

`src/domain/` holds the genealogy types, Zod runtime schemas, validation, name/date formatting, relationship traversal, and kinship logic. It remains independent of Next.js, React, and React Flow. React components transform domain records into React Flow nodes/edges. Immediate family uses a compact three-row layout; ancestors, descendants, and paths use ELK automatic layout. Graph positions are never stored in family data.

| Location | Purpose |
| --- | --- |
| `src/app/` | App Router pages, layout, login form, and API route handlers |
| `src/auth.ts` | Auth.js Credentials provider and seven-day JWT session configuration |
| `src/proxy.ts` | Redirects unauthenticated page requests and rejects protected API requests |
| `src/server/family-data.ts` | Server-only JSON loading and validation |
| `src/server/photos.ts` | Server-only photo reading, path validation, and filesystem containment checks |
| `src/app/FamilyClient.tsx` | Fetches authenticated records and initializes the existing React app |
| `src/App.tsx`, `src/components/`, `src/styles.css` | Existing exploration UI, graph rendering, and styling |
| `src/data/types.ts` | Shared archive types; contains no family records |
| `private-data/people.json` | Stable person IDs, names, life facts, nested events, and portrait references |
| `private-data/relationships.json` | Directed parent/guardian records and symmetric spouse/partner connections |
| `private-data/config.ts` | Server-only title, subtitle, demo flag, and featured person IDs |
| `private-media/` | Private portrait files; starter data has none |
| `next.config.ts` | Next.js configuration and runtime tracing for private JSON and media |

After login, `FamilyClient` fetches `/api/family-data`. That route independently checks the Auth.js session, loads and validates the JSON on the server, and returns records and archive configuration with `Cache-Control: private, no-store`. The client validates the received records and initializes the existing genealogy model. Private JSON and configuration are never imported into Client Components or browser bundles.

Portraits use `/api/photos/[...filename]`, including nested relative paths. The photo route independently checks authentication, accepts supported image filenames, rejects unsafe paths, checks resolved filesystem containment, and returns 404 for missing or invalid files. Photo responses use `Cache-Control: private, no-store`.

The demonstration has 26 entirely fictional people across five generations, with invented places and details. It includes half-siblings, remarriage, an unmarried couple, adoption, step-parents, guardianship, uncertain parentage, changed names, incomplete records, and deceased people. Connected branches and partnership edges form cycles that exercise traversal. It is ready to explore after cloning and supplying local secrets.

See [the schema guide](docs/DATA_SCHEMA.md) for every field, editing examples, and traversal rules.

## Keep private family data separate

This public repository must only contain synthetic data. **A repository containing real family records, configuration, or photos must remain private**, along with its deployment workspace and build artifacts.

The simplest deployment setup is a private copy of the application repository. Replace the demonstration JSON in `private-data/`, place photographs in `private-media/`, and update `private-data/config.ts`, including setting `isDemo` to `false`. The app falls back to available people if the featured IDs are absent. Keep portrait `file` values relative to `private-media/`, for example `portraits/p0012.webp`.

If using separate code and data repositories, assemble them in a private deployment workspace before building: copy records and configuration into `private-data/` and photographs into `private-media/`. Those files must be present when Vercel builds and traces the server functions. Never copy private records or photos into `public/`, and never publish the assembled workspace or server build artifacts.

Avoid logging private records in public CI systems. Existing domain tests assert fictional starter examples; run them against the synthetic dataset before replacing it. Private records are validated by the server when an authenticated client loads the archive, and again by the client before rendering. A successful build alone does not validate replacement JSON.

## Deployment

### Vercel

1. Import the private deployment repository into a Vercel project. Ensure its configured root contains `package.json`, `private-data/`, and `private-media/`.
2. Select the **Next.js** framework preset and **Node.js 22.x**. Use `npm ci` to install and `npm run build` to build. Leave the Output Directory at the framework default.
3. In the project's **Settings → Environment Variables**, set `FAMILY_PASSWORD` and `AUTH_SECRET` to private values. Enable them for Production and for any Preview deployments that should work; Development is optional for local environment synchronization. Keep preview data synthetic unless those deployments are intended to expose the private archive to password holders.
4. Deploy after adding the variables. Changes to environment variables require a new deployment to take effect. Use HTTPS for the deployed archive.
5. Run the access checks below against the deployment, including a protected photo request if you have added media.

See Vercel's [environment variable guide](https://vercel.com/docs/environment-variables) and [supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

`next.config.ts` includes `private-data/**/*.json` in the family-data function and `private-media/**/*` in the photo function through output file tracing. Keep these directories in the deployment root. Updating JSON, photos, or `private-data/config.ts` on Vercel requires rebuilding and redeploying. No database, Vercel Blob, or external media storage is required.

### Node.js hosting

On a private server with Node 22, install dependencies with `npm ci`, provide the two secrets through the process environment or a private `.env.local`, run `npm run build`, then `npm run start`. Run from the application root with `private-data/` and `private-media/` available. Use a process supervisor and an HTTPS reverse proxy for a persistent deployment. Do not configure a proxy or web server to serve these private directories directly or to publicly cache protected responses.

Next.js supports this [Node.js server deployment workflow](https://nextjs.org/docs/app/getting-started/deploying). This application requires server-side sessions and route handlers: serving a static directory, uploading `dist/`, or enabling `output: 'export'` cannot provide its privacy boundary. Hosting elsewhere requires support for the application's Next.js server features. The current routes and fetch URLs assume deployment at the domain root.

## Security model

- A visitor without a valid Auth.js session is redirected to `/login` for protected pages. Protected API requests return 401.
- The root page and private API routes verify authentication independently of `src/proxy.ts`.
- Password comparison uses fixed-length SHA-256 digests and a timing-safe comparison; Auth.js manages session-cookie cryptography.
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

Run `npm test`, `npm run typecheck`, and `npm run build`. Start the production server and verify the following while logged out, without following redirects:

```sh
curl -i http://localhost:3000/
curl -i http://localhost:3000/api/family-data
curl -i http://localhost:3000/api/photos/example.jpg
curl -i http://localhost:3000/private-data/people.json
curl -i http://localhost:3000/people.json
curl -i http://localhost:3000/data/people.json
```

The root should redirect to `/login`; both API requests should return 401; all three direct JSON paths should return 404. Substitute your HTTPS deployment origin for the local origin when checking hosting.

In the browser, verify wrong-password rejection, successful login, refresh with a valid session, all exploration views at desktop/mobile widths, and logout followed by rejected private API requests. Authenticated data and photo responses should have `Cache-Control: private, no-store`; a missing photo should return 404 after login. Inspect `.next/static/` JavaScript for distinctive dataset values to check that records were not embedded in browser bundles. Automated authentication/security and responsive browser tests remain to be added; the existing tests cover domain and validation behavior.

## Status and limits

V1 focuses on a small family archive (tens to a few hundred people). Ancestor/descendant views are limited to 2–5 generations and show repeated ancestors once. Paths show one shortest route across all connection types. Kinship terms are only emitted for routes whose biological meaning is clear; paths through adoption, step relationships, guardians, marriage, uncertain parentage, and ambiguous half-siblings retain explicit relationship labels. Spouse records are historical connections without start/end status; divorce events provide context.

No editing, individual accounts, source management, GEDCOM, maps, research integrations, or arbitrary event types are included. Future work could add richer partnership dates and source provenance, additional kinship descriptions, and shareable exploration links.

## Contributing

Keep the domain independent of frameworks and rendering, use fictional data in contributions, and update the schema guide whenever records change. Run tests, TypeScript checks, and the production build before submitting a change; verify primary flows at desktop and mobile sizes and preserve authenticated data boundaries. Avoid adding services or infrastructure for features outside [the project scope](docs/PROJECT_SCOPE.md).
