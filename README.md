# Kindred

A calm, read-only family archive built with React, TypeScript, and Vite. Start with a person, follow their closest connections, discover ancestors and descendants, or trace the relationship between two people. The repository owner maintains the records in ordinary JSON.

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

The app runs entirely in the browser after build. There are no accounts, backend, database, external fonts, or genealogy services.

## Run locally

Requires Node.js 22.12+ (the development container uses Node 22).

```sh
npm install
npm run dev
```

Open the Vite address printed in the terminal (normally `http://localhost:5173`).

```sh
npm test          # domain and validation tests
npm run build    # TypeScript check and production build
npm run preview  # serve the production build locally
```

### VS Code Dev Container

Open the folder in VS Code with the Dev Containers extension and choose **Reopen in Container**. `.devcontainer/devcontainer.json` uses the standard Microsoft Node 22 image, installs dependencies on creation, and forwards port 5173. Run `npm run dev` in the container terminal. No custom Docker image is needed.

## Architecture and data

`src/domain/` holds the genealogy types, Zod runtime schemas, validation, name/date formatting, relationship traversal, and kinship logic. It has no React or React Flow dependency. `src/data/load.ts` loads and validates the two JSON arrays before mounting the app. React components transform domain records into React Flow nodes/edges. Immediate family uses a compact three-row layout; ancestors, descendants, and paths use ELK automatic layout. Graph positions are never stored in family data.

- `src/data/people.json`: stable person IDs, names, life facts, nested events, optional portraits.
- `src/data/relationships.json`: independent directed parent/guardian records and symmetric spouse/partner connections.
- `src/data/config.ts`: title and featured starting people.
- `public/photos/`: optional image files; starter data has none.

The bundled demonstration has 26 entirely fictional people across five generations, with invented places and details. It includes half-siblings, remarriage, an unmarried couple, adoption, step-parents, guardianship, uncertain parentage, changed names, incomplete records, and deceased people. Connected branches and partnership edges form cycles that exercise traversal. It is ready to explore after cloning.

See [the schema guide](docs/DATA_SCHEMA.md) for every field, editing examples, and traversal rules.

## Keep private family data separate

The recommended setup is a public `kindred-family` repository and a separate private `my-kindred-family` repository holding your people, relationships, configuration, and photos. Do not commit real family records or media to the public application repository.

Use a private build workspace/deployment project that checks out both repositories. Before building, copy the private JSON files into the application's `src/data/` directory and private photos into `public/photos/`, replacing the demonstration files **only in that private workspace**. Alternatively, change the two imports in `src/data/load.ts` to build-time files supplied by that workspace. Update the featured IDs/title in `src/data/config.ts` and set `isDemo` to `false`. The app falls back to available people if the demonstration IDs are absent. Never push the resulting workspace or bundle to the public source repository.

The data boundary is deliberately small so loading can be changed without rewriting the UI. No accidental gitignore pattern is used as the privacy strategy. Static HTML/JavaScript and media expose the complete data to anyone who can access them; use deployment-level access protection for a private archive. Avoid logging private records in public CI systems. The synthetic-data tests assert demo examples; keep a public demo test job, and validate private data during startup in your private deployment.

## Static deployment

On Vercel, Netlify, Cloudflare Pages, or equivalent hosting, use `npm run build` and serve `dist/`. Select Node 22. No server process is needed. `npm run preview` is for local build verification. The app uses no URL routes, so no SPA rewrite rule is required. For hosting under a subdirectory, set Vite's `base` option; portrait URLs honor the build's base path. A private deployment should protect all assets, including media and JavaScript bundles.

## Status and limits

V1 focuses on a small family archive (tens to a few hundred people). Ancestor/descendant views are limited to 2–5 generations and show repeated ancestors once. Paths show one shortest route across all connection types. Kinship terms are only emitted for routes whose biological meaning is clear; paths through adoption, step relationships, guardians, marriage, uncertain parentage, and ambiguous half-siblings retain explicit relationship labels. Spouse records are historical connections without start/end status; divorce events provide context.

No editing, accounts, source management, GEDCOM, maps, research integrations, or arbitrary event types are included. Future work could add richer partnership dates and source provenance, additional kinship descriptions, and shareable exploration links.

## Contributing

Keep the domain independent of rendering, use fictional data in contributions, and update the schema guide whenever records change. Run tests and the production build before submitting a change; verify primary flows at desktop and mobile sizes. Avoid adding services or infrastructure for features outside [the V1 scope](docs/PROJECT_SCOPE.md).
