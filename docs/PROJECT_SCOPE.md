# Kindred project scope

This document describes the existing V1 product and its Next.js authentication and private-data architecture. Preserve the working interface and genealogy logic when making changes. [DATA_SCHEMA.md](DATA_SCHEMA.md) documents the implemented record format; [README.md](../README.md) provides current setup and deployment instructions.

## Project Overview

Maintain a responsive, read-only Next.js App Router application with an existing React interface for exploring family-tree information stored in server-only, repository-managed JSON files.

The application is intended primarily as a private family archive and exploration tool. It should make it easy to document family information in a format the repository owner controls, explore relationships visually, identify gaps in known information, and show the family structure to relatives.

The core application should be suitable for open-source release. Real family data, photos, and deployment-specific content are expected to live separately from the public application code.

The initial implementation should prioritize:

- clear and attractive visualization;
- a simple, human-editable data format;
- multiple views over the same underlying family graph;
- robust handling of non-trivial family relationships;
- explicit representation of uncertainty;
- strong desktop and mobile usability;
- a lightweight architecture appropriate for a family dataset of fewer than 100 people initially and at most a few hundred in the foreseeable future.

The application does **not** need an editing interface. Data will be maintained directly in JSON.

---

## Product Goals

The application should:

1. Provide a pleasant, intuitive way to explore a family graph.
2. Support a person-centred immediate-family view.
3. Support ancestor/pedigree views.
4. Support descendant views.
5. Support relationship/path finding between any two people.
6. Translate relationship paths into human-readable kinship labels when reasonably possible.
7. Display structured biographical facts and major life events.
8. Support up to 1–3 portrait photos per person, while gracefully handling missing photos.
9. Represent uncertainty using a qualitative confidence scale.
10. Be straightforward to deploy on Vercel or a Next.js-compatible Node.js server with authenticated access to private data.
11. Keep the generic application suitable for public/open-source release while allowing real family data to remain private.
12. Keep the underlying family-data schema easy for a technically comfortable person to edit manually.

---

## Explicit Non-Goals for V1

Do **not** add the following unless required for a core V1 feature:

- in-browser data editing;
- user accounts;
- multi-user collaboration;
- backend features beyond authentication and protected, read-only family-data/photo routes;
- a database server;
- Ancestry or other genealogy-platform integrations;
- automated genealogical research;
- automated record matching;
- AI-generated family information;
- document/source management;
- source citations or evidence repositories;
- free-text biographies;
- maps;
- GEDCOM import/export;
- cloud media management;
- upload interfaces;
- arbitrary user-defined event types.

The architecture should not unnecessarily prevent these from being added later, but V1 should remain intentionally small.

---

## Recommended Technical Stack

Use:

- React
- TypeScript
- Next.js App Router with Node.js server execution
- Auth.js / NextAuth Credentials with a shared password and stateless JWT sessions
- React Flow / `@xyflow/react` for graph rendering
- ELK / `elkjs` for automatic graph layout where useful
- client-side exploration state after authenticated server-side data loading
- server-only JSON files in `private-data/` as the family-data source of truth
- private photographs in `private-media/`, served through authenticated route handlers

Avoid unnecessary dependencies.

The exploration UI and genealogy calculations run client-side after authenticated loading. Authentication and private-file access run on the Next.js server; private records must never be embedded in browser bundles.

No external services should be required to view or navigate family data.

---

## Architectural Principles

### Authentication and private-data boundary

Use one shared family password with no user database or individual accounts. `src/auth.ts` configures Auth.js Credentials with a stateless JWT session lasting approximately seven days. Secrets are `FAMILY_PASSWORD` and `AUTH_SECRET`; neither may have a `NEXT_PUBLIC_` prefix. `.env.example` contains empty variable names only. Local values belong in ignored `.env.local`; deployment values belong in the hosting environment.

`src/proxy.ts` redirects unauthenticated protected page requests to `/login` and returns 401 for protected API requests. `/login`, `/api/auth/*`, and framework assets needed for authentication remain accessible. The protected root page and both private API routes also verify the Auth.js session independently of Proxy.

`src/server/family-data.ts` is marked `server-only` and reads and validates `private-data/people.json` and `private-data/relationships.json`. `/api/family-data` returns these records and server-only archive configuration only after authentication, with `Cache-Control: private, no-store`. `src/app/FamilyClient.tsx` fetches those records, validates them, and initializes the preserved React app.

Photos live under `private-media/`, including supported nested relative paths. `/api/photos/[...filename]` independently checks authentication, validates filenames, prevents traversal and symlink escape, returns 404 for missing or invalid files, and uses a private/no-store cache policy. Unauthenticated requests return 401. Never store private JSON or photos in `public/` or import private data into Client Components.

Anyone with the shared password can download the complete archive. This provides shared-password access without individual authorization. Logout clears the current browser session; stateless tokens have no individual server-side revocation. To respond to a compromised password, change both `FAMILY_PASSWORD` and `AUTH_SECRET` and redeploy all affected environments. Rotating `AUTH_SECRET` invalidates existing sessions on deployments using the new value; changing only the password does not invalidate existing sessions or selectively revoke a family member.

### 1. Separate genealogy data from visualization data

The family-data model must **not** use React Flow node/edge objects as its persistent format.

Create a clear transformation layer:

```text
Server-only family JSON
    |
    v
Authenticated /api/family-data (server validation)
    |
    v
Genealogy/domain model (client validation)
    |
    +--> Immediate-family graph
    +--> Ancestor graph
    +--> Descendant graph
    +--> Relationship path
    |
    v
React Flow nodes + edges
```

The domain layer should contain the core logic for:

- looking up people;
- resolving names;
- determining parents/children/partners;
- finding siblings;
- finding ancestors;
- finding descendants;
- traversing relationships;
- finding shortest relationship paths;
- deriving human-readable kinship labels where practical;
- applying confidence and display rules.

### 2. Treat genealogy as a graph, not a nested tree

Do not nest children inside parents or parents inside children.

People should be stable entities with unique IDs.

Relationships should be separate records connecting person IDs.

This must support:

- multiple spouses/partners;
- biological parents;
- adoptive parents;
- step-parents;
- guardians;
- half-siblings;
- multiple marriages;
- remarriage;
- non-traditional family structures;
- uncertain relationships;
- pedigree collapse;
- cycles that can legitimately occur in a genealogy graph.

### 3. Keep data human-editable

The family JSON files are expected to be manually maintained.

Favor clear, explicit structures over excessive normalization.

Avoid structures that require the maintainer to understand implementation details.

---

# Data Model

The genealogy schema is unchanged by authentication. The following describes the product requirements; use [DATA_SCHEMA.md](DATA_SCHEMA.md) for the complete implemented format.

The implemented schema must be:

1. represented as TypeScript types;
2. validated at runtime before rendering;
3. fully documented in `README.md` or a dedicated documentation file such as `docs/DATA_SCHEMA.md`;
4. illustrated with examples;
5. kept synchronized with the actual implementation.

If a dedicated schema document is used, the README should prominently link to it.

A contributor should be able to create or modify family data without inspecting application source code.

---

## Confidence Scale

Use the following qualitative scale:

```text
confirmed
probable
possible
speculative
```

Confidence metadata should be optional.

If confidence is omitted, treat the value as:

```text
confirmed
```

Confidence should be visually represented in an accessible way.

Do not rely on colour alone.

Possible treatments include:

- labels;
- icons;
- line styles;
- badges;
- tooltips or accessible text.

---

## Dates

Genealogical dates must support:

- exact dates;
- partial dates;
- approximate dates;
- before dates;
- after dates;
- ranges.

Prefer ISO-like machine-readable values.

Examples:

```json
{
  "value": "1942-05-18",
  "qualifier": "exact"
}
```

```json
{
  "value": "1942",
  "qualifier": "about",
  "confidence": "probable"
}
```

```json
{
  "value": "1890",
  "qualifier": "before"
}
```

```json
{
  "start": "1910",
  "end": "1914",
  "qualifier": "range"
}
```

Partial values should be permitted:

```text
YYYY
YYYY-MM
YYYY-MM-DD
```

The UI should format these naturally for human readers.

Examples:

```text
18 May 1942
May 1942
1942
c. 1942
before 1890
1910-1914
```

The implementation should preserve date-only values without timezone-related shifts.

---

## Places

Places are objects with a required nonempty `value` string and optional `confidence`, as in the example below.

Example:

```json
{
  "value": "Guelph, Ontario",
  "confidence": "confirmed"
}
```

Do not introduce geographic IDs, coordinates, or hierarchical place databases in V1.

---

# Person Schema

Each person must have a unique stable ID.

Suggested structure:

```json
{
  "id": "p0012",
  "names": [
    {
      "given": "Margaret Anne",
      "surname": "Smith",
      "type": "current"
    },
    {
      "given": "Margaret Anne",
      "surname": "McDonald",
      "type": "birth"
    }
  ],
  "sex": "female",
  "birth": {
    "date": {
      "value": "1942-05-18",
      "qualifier": "exact"
    },
    "place": {
      "value": "Guelph, Ontario"
    }
  },
  "death": null,
  "events": [],
  "photos": []
}
```

## Required Person Fields

At minimum:

```text
id
names
```

## Names

Support name changes over time.

A person may have multiple name entries.

V1 should support a controlled name type such as:

```text
current
birth
former
alternate
nickname
```

The current or most recent name should be used as the default display name.

If no `current` name exists, use a sensible fallback.

Search should match all stored names, not only the display name.

Do not require narrative explanations for name changes.

---

## Sex / Gender Field

Keep this field simple and optional.

The implementation may use a conservative controlled vocabulary plus an `other` or `unknown` option.

Do not use this field to infer relationships.

---

# Life Facts

Birth and death should be first-class structured facts because they are frequently displayed.

Each may contain:

```text
date
place
```

Each individual date/place field may independently carry confidence metadata.

Example:

```json
{
  "birth": {
    "date": {
      "value": "1884",
      "qualifier": "about",
      "confidence": "probable"
    },
    "place": {
      "value": "Hamilton, Ontario",
      "confidence": "possible"
    }
  }
}
```

Unknown values may be omitted or set to `null`.

---

# Event Schema

Support a predefined event vocabulary.

V1 event types:

```text
marriage
divorce
residence
immigration
education
occupation
```

Birth and death should remain first-class person fields rather than generic events.

Suggested event structure:

```json
{
  "type": "residence",
  "date": {
    "value": "1972",
    "qualifier": "exact"
  },
  "place": {
    "value": "Toronto, Ontario"
  },
  "confidence": "confirmed"
}
```

Not every event requires every field.

Events may be sparse.

Do not add free-text biographies in V1.

A short structured label/value may be used where necessary, for example an occupation title.

---

# Photo Schema

Support 0–3 portrait photographs per person.

Photos are expected to represent different life stages.

The app must work well when no photo exists.

Suggested structure:

```json
{
  "file": "p0012-1965.webp",
  "label": "1965",
  "primary": true
}
```

Optional useful fields may include:

```text
date
label
primary
```

Do not embed binary image data or base64 image data in JSON.

Store photo files separately under `private-media/`. The `file` value is a relative path within that directory and is requested through `/api/photos/[...filename]`. See [the photo guide](DATA_SCHEMA.md#photos) for accepted paths and extensions.

Where no photo is available, render a clean fallback avatar using initials or another neutral treatment.

Do not require photos in the synthetic starter dataset.

---

# Relationship Schema

Relationships are first-class records stored independently from people.

Implemented structure:

```json
{
  "id": "r0037",
  "from": "p0041",
  "to": "p0012",
  "type": "biological_parent",
  "confidence": "confirmed"
}
```

For parent/guardian relationships, `from` is the parent or guardian and `to` is the child or ward. Spouse and partner records are symmetric. Both endpoints reference existing person IDs. See [the schema guide](DATA_SCHEMA.md#relationships) for validation and traversal details.

## V1 Relationship Types

Support at least:

```text
biological_parent
adoptive_parent
step_parent
guardian
spouse
partner
```

Uncertainty is **not** a separate relationship type.

Use the standard confidence property instead.

Example:

```json
{
  "id": "r0081",
  "from": "p0041",
  "to": "p0099",
  "type": "biological_parent",
  "confidence": "possible"
}
```

Half-sibling relationships should be inferred through shared parent relationships rather than explicitly stored.

Sibling relationships generally should be derived rather than stored.

---

# Relationship Traversal Semantics

For path finding, all supported family relationship types should be traversable.

For V1 path calculations, biological, adoptive, step, guardian, spouse, and partner connections may be treated as equivalent graph connections for the purpose of finding a route.

However, the path visualization should preserve and display the actual edge type.

Example:

```text
Alex
  |
child of
  |
Morgan
  |
sibling of
  |
Taylor
  |
parent of
  |
Jordan
```

When possible, provide a conventional kinship label such as:

```text
mother
grandfather
great-grandmother
aunt
uncle
first cousin
second cousin
first cousin once removed
```

For relationships that pass through marriage, step relationships, guardianship, adoption, or otherwise become difficult to express accurately using conventional kinship terminology:

- display the actual path;
- provide a simple human-readable description if one can be generated confidently;
- do not invent awkward or misleading kinship labels.

---

# Core Views

## 1. Home Screen

Create a lightweight home screen.

It should not be dominated by a full family tree.

Include:

- application title;
- concise introduction;
- prominent person search;
- optional featured/start people from configuration or starter data;
- clear entry points into exploration.

The home screen should work well on desktop and mobile.

---

## 2. Person-Centred Immediate-Family View

This is the primary exploration view.

For the selected person, show:

- parents;
- siblings;
- partners/spouses;
- children.

The selected person should be visually central.

Clicking/tapping another person should make that person the new centre.

The view should support:

- pan;
- zoom;
- touch interaction;
- keyboard-accessible selection where practical.

Selecting a person should also expose a person-details panel.

Desktop:

```text
side panel
```

Mobile:

```text
bottom sheet / vertically stacked detail panel
```

---

## 3. Ancestor / Pedigree View

Show the selected person's ancestors.

Support a bounded generation selector, for example:

```text
2 generations
3 generations
4 generations
5 generations
```

Do not render the entire known ancestry by default.

The selected person should remain the conceptual root.

Use automatic layout to minimize edge crossings and preserve generational readability.

---

## 4. Descendant View

Show the selected person's descendants.

Use the same general generation-control pattern as the ancestor view.

The layout should remain readable on both desktop and mobile.

---

## 5. Relationship / Path View

Allow the user to choose any two people.

Provide:

1. the shortest traversable relationship path;
2. a visual representation of that path;
3. the relationship edge labels;
4. a conventional human-readable relationship label when feasible.

Examples:

```text
Sarah is your first cousin.
Robert is your great-great-grandfather.
```

If a clean conventional label is not appropriate, show the path without pretending there is one.

Path calculations must safely handle cycles.

---

# Person Detail Panel

When a person is selected, display a concise structured profile.

Include where available:

- preferred/current name;
- alternate or former names;
- portrait(s);
- birth date;
- birth place;
- death date;
- death place;
- major structured events;
- confidence indicators on uncertain fields.

No free-text biography is required.

The panel should remain visually useful even for very sparse records.

---

# Search

Provide fast client-side person search.

Search should match:

- current name;
- birth name;
- former names;
- alternate names;
- nicknames.

The expected dataset is small enough to search entirely in memory.

Results should show enough context to distinguish people with similar names, for example:

```text
name
birth/death years
```

---

# Layout and Interaction Requirements

The app must be usable on:

- desktop;
- tablet;
- mobile phone.

Avoid designs that only work with hover.

Primary actions must work by click/tap.

Graph nodes should remain legible at practical mobile widths.

Support zoom controls in addition to gestures where helpful.

Do not attempt to show hundreds of people simultaneously.

Prefer bounded, person-centred exploration.

---

# Performance Expectations

Expected data size:

```text
initially <100 people
future: a few hundred people
```

Load the complete family dataset into client memory after login through one authenticated `/api/family-data` request. Keep search, relationship queries, and graph calculations in the browser.

Do not add:

- pagination;
- server-side graph queries;
- database indexing;
- per-person or per-graph network retrieval;
- backend caching.

Graph operations on this scale should be client-side.

Avoid unnecessary React rerenders, particularly around React Flow.

---

# Runtime Validation

Validate family data on the server for each authenticated family-data load and again on the client before rendering. The production build alone does not validate replacement JSON.

Validation should catch at least:

- duplicate person IDs;
- duplicate relationship IDs;
- malformed names;
- unsupported confidence values;
- unsupported event types;
- unsupported relationship types;
- invalid relationship references;
- self-referential relationships where inappropriate;
- malformed date structures;
- missing required fields;
- more than the supported number of photos if that limit is enforced.

If validation fails:

- do not crash with an opaque error;
- provide an authenticated error view identifying the relevant record and problem;
- keep validation details behind the session boundary.

Consider using a lightweight schema-validation library if helpful, but do not add unnecessary complexity.

---

# Data Schema Documentation

Schema documentation is a required deliverable.

Create either:

```text
docs/DATA_SCHEMA.md
```

or an equivalently clear documentation file.

It must document:

- all supported files;
- all record types;
- required fields;
- optional fields;
- confidence values;
- relationship types;
- event types;
- date syntax;
- photo syntax;
- name handling;
- examples;
- rules for stable IDs;
- how missing/unknown values are represented;
- how to add a person;
- how to add a relationship;
- how to add an uncertain fact;
- how to add/change a name;
- how to add a photo.

`README.md` must link prominently to this documentation.

Do not leave the schema documented only in TypeScript source code.

---

# Synthetic Starter Data

Create a synthetic demonstration family dataset.

Do **not** use real people.

Do **not** include photos in the starter data.

The starter data should be rich enough to exercise the application's important logic.

Include approximately 20–30 fictional people spanning at least four generations.

The synthetic family should deliberately include:

- multiple generations;
- siblings;
- half-siblings;
- at least one remarriage;
- at least one unmarried partner relationship;
- at least one adoptive parent relationship;
- at least one step-parent relationship;
- at least one guardian relationship;
- at least one uncertain parent relationship;
- at least one uncertain date or place;
- at least one person with a name change;
- at least one nickname or alternate name;
- one or more deceased people;
- several living people;
- incomplete records;
- missing birth/death information where appropriate;
- several predefined event types;
- relationship paths suitable for demonstrating cousin relationships;
- enough complexity to test cycle-safe graph traversal.

Use obviously fictional names and plausible but invented details.

The starter dataset should make the app useful immediately after cloning, supplying local environment secrets, starting the development server, and signing in.

---

# Repository / Data Separation

Design the public application so that real private family data can live outside the public repository.

Preferred long-term pattern:

```text
family-tree-app      public
my-family            private
```

The public project should include only:

- source code;
- schemas/types;
- synthetic starter data;
- documentation;
- configuration examples.

Do not include assumptions about a specific real family.

Keep the repository containing real family data private. A private application copy can hold records in `private-data/` and photos in `private-media/`. With separate code and data repositories, assemble those directories in a private deployment workspace before the Next.js build. Set the private archive title, featured IDs, and `isDemo: false` in `private-data/config.ts`. Never copy private files into `public/` or publish private build artifacts.

Document the recommended approach for private deployment.

Do not rely on accidentally ignored sensitive files as the primary long-term privacy strategy.

---

# Deployment

Deploy using the Next.js server runtime, on Vercel with its Next.js preset or on a Node.js server. Static-only hosting and static export cannot support the authentication and private-data routes.

Use Node.js 22. For Vercel, set `FAMILY_PASSWORD` and `AUTH_SECRET` in project environment variables for each intended environment, use `npm ci` and `npm run build`, and leave the Output Directory at the framework default. Redeploy after changing secrets or private data. Keep Preview deployments synthetic unless they are intended to hold the private archive.

`next.config.ts` includes private JSON and media in the relevant server functions through output file tracing. Both directories must exist in the deployment workspace before building. There is no database or external media service.

For a Node.js server, provide private environment values and run from the application root with `private-data/` and `private-media/` available:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run start
```

Run synthetic-data tests before replacing the starter files with private records. `npm run dev` starts local development on port 3000; `npm run preview` is an alias for `npm run start` and requires a build. Use HTTPS in production. Keep private directories inaccessible to static-file serving and disable public caching of authenticated data and media.

See [README deployment instructions](../README.md#deployment) for Vercel configuration, Node.js hosting, secret generation and rotation, and production access checks.

---

# Dev Container

Include an appropriate VS Code Dev Container configuration.

Use a standard Node.js development container suitable for Next.js/React/TypeScript development.

Recommended baseline:

```text
Node.js 22
```

Create:

```text
.devcontainer/
  devcontainer.json
```

Use a standard Microsoft Dev Containers image rather than building a custom image unless there is a strong reason otherwise.

Suggested image family:

```text
mcr.microsoft.com/devcontainers/javascript-node
```

Pin an appropriate Node 22 tag.

The container should:

- support `npm`;
- install project dependencies after container creation if appropriate;
- expose or forward the Next.js development port, 3000;
- work in VS Code Dev Containers after the owner supplies `.env.local`;
- avoid unnecessary features and packages.

Do not create a heavyweight Docker setup when a standard devcontainer image is sufficient.

Document Dev Container usage briefly in the README.

---

# Repository Structure

The current architecture is:

```text
.
├── .devcontainer/
│   └── devcontainer.json
├── .env.example
├── docs/
│   ├── DATA_SCHEMA.md
│   └── PROJECT_SCOPE.md
├── private-data/
│   ├── config.ts
│   ├── people.json
│   └── relationships.json
├── private-media/
├── public/                    # non-sensitive assets only
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── family-data/route.ts
│   │   │   └── photos/[...filename]/route.ts
│   │   ├── login/
│   │   │   ├── LoginForm.tsx
│   │   │   └── page.tsx
│   │   ├── FamilyClient.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── FamilyGraph.tsx
│   │   ├── Icons.tsx
│   │   ├── PersonSearch.tsx
│   │   └── PersonUI.tsx
│   ├── data/
│   │   └── types.ts
│   ├── domain/
│   │   ├── genealogy.test.ts
│   │   ├── genealogy.ts
│   │   ├── kinship.ts
│   │   ├── types.ts
│   │   └── validation.ts
│   ├── server/
│   │   ├── family-data.ts
│   │   ├── password.ts
│   │   ├── photos.ts
│   │   └── responses.ts
│   ├── App.tsx
│   ├── auth.ts
│   ├── proxy.ts
│   └── styles.css
├── next.config.ts
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
└── vitest.config.ts
```

Events remain nested under people. No family records belong under `src/data/` or `public/`. `.next/` is generated build output and must not be published as a public archive or treated as a static-only deployment.

---

# Visual Design Direction

The interface should feel:

- calm;
- modern;
- personal;
- uncluttered;
- appropriate for showing to family members;
- understandable without genealogy expertise.

Avoid:

- dense admin-dashboard styling;
- overly technical graph visuals;
- excessive controls;
- tiny labels;
- visual noise.

Person nodes should emphasize:

1. portrait or fallback avatar;
2. preferred name;
3. lifespan or birth/death information;
4. uncertainty only where relevant.

Confidence indicators should be visible without dominating the interface.

---

# Accessibility

At minimum:

- do not encode confidence or relationship type using colour alone;
- provide accessible labels for graph controls;
- ensure text contrast is sufficient;
- make primary navigation keyboard accessible;
- provide usable focus states;
- make tap targets suitable for mobile use;
- provide alt text for real photos when photos are later added;
- ensure missing-image fallbacks are meaningful.

---

# Testing

Add automated tests for domain logic where practical.

At minimum test:

- parent/child resolution;
- sibling resolution;
- half-sibling handling;
- ancestor traversal;
- descendant traversal;
- cycle safety;
- shortest-path calculation;
- relationship/path handling through spouse/partner edges;
- relationship/path handling through adoptive/step/guardian edges;
- confidence defaults;
- invalid references;
- name fallback/display logic;
- approximate/partial date formatting;
- basic kinship labels;
- behavior when a conventional kinship label cannot confidently be produced.

Also run the production-style application manually and verify responsive behavior at representative desktop and mobile widths after login.

Verify the privacy boundary:

- logged-out root requests redirect to `/login`;
- `/api/family-data` and `/api/photos/example.jpg` return 401 while logged out;
- likely direct file paths, including `/private-data/people.json`, `/people.json`, and `/data/people.json`, return 404;
- wrong passwords fail and correct passwords establish sessions;
- refresh preserves a valid session, and logout removes current-browser access to protected APIs;
- authenticated private data and media use `Cache-Control: private, no-store`;
- missing and unsafe photo paths return 404 after login;
- browser JavaScript under `.next/static/` does not embed private dataset values.

Add automated authentication and security tests where practical. The current automated suite covers domain and validation behavior; the `test:e2e` script has no Playwright suite or configuration yet. See [README access checks](../README.md#access-checks-before-sharing-a-deployment) for runnable production checks.

---

# README Requirements

Create a polished `README.md`.

It should include:

- what the project is;
- why it exists;
- screenshots or placeholders may be added later;
- main features;
- local development instructions, including `.env.local` and generation of `AUTH_SECRET`;
- Dev Container instructions;
- build instructions;
- Vercel and Node.js deployment instructions, including environment variables and runtime private-file packaging;
- data-file overview;
- prominent link to full schema documentation;
- explanation of synthetic starter data;
- explanation of server-only private data and photos, the shared-password security model, and secret rotation;
- project status / V1 limitations;
- open-source contribution guidance as appropriate.

The README should make sense to someone discovering the public repository without prior context.

---

# Implementation Guidance

Prioritize a working, coherent V1 over speculative extensibility.

Do not build infrastructure for features outside scope.

When choosing between:

```text
simple and explicit
```

and:

```text
abstract and theoretically flexible
```

prefer the former unless the abstraction clearly improves the current feature set.

The JSON should remain approachable enough that a repository owner can add a relative by hand without needing a dedicated editor.

---

# Definition of Done

V1 is complete when:

1. The project builds successfully.
2. It runs locally in the provided Dev Container.
3. Synthetic starter data loads without errors after shared-password login.
4. The home screen is usable and responsive.
5. A person can be searched and selected.
6. Immediate-family visualization works.
7. Ancestor visualization works.
8. Descendant visualization works.
9. Relationship/path visualization works.
10. Clicking/tapping people allows intuitive re-centering/navigation.
11. Person details display correctly.
12. Missing photos are handled gracefully.
13. Confidence values render correctly.
14. Partial/approximate dates render correctly.
15. Complex synthetic relationships render without breaking the graph.
16. Relationship traversal is cycle-safe.
17. The application works at representative desktop and mobile widths.
18. Production build succeeds.
19. Core domain tests pass.
20. `README.md` is complete.
21. The implemented data schema is fully documented in README and/or `docs/DATA_SCHEMA.md`.
22. `.devcontainer/devcontainer.json` is included and functional.
23. Server functionality is limited to authentication and protected file access; no database, user-account system, or unnecessary service is added.
24. No real family information is included in the public starter project.
25. Auth.js Credentials uses a shared password, private environment secrets, and approximately seven-day stateless sessions.
26. Protected pages and APIs independently enforce authentication, and logout removes current-browser access.
27. Private JSON and photos remain server-only and cannot be retrieved through direct static-file URLs.
28. Browser bundles do not embed private records, and protected data/media responses use private/no-store caching.
29. README documents local secrets, Vercel and Node.js deployment, private-file handling, and compromise response.

This checklist defines acceptance criteria; it does not assert that every automated security test or responsive browser verification has already been completed.

---

# Maintenance Guidance

Maintain the existing V1 described in this file. Preserve the working application when adapting its infrastructure; do not rebuild or redesign it.

Use this document for product scope and [DATA_SCHEMA.md](DATA_SCHEMA.md) for the implemented schema.

Use reasonable implementation judgment where a low-level detail is not specified, but do not expand the product beyond the stated scope.

In particular:

- retain the Next.js App Router architecture and existing React/TypeScript application;
- implement the genealogy domain layer separately from React Flow rendering;
- define and validate the JSON schemas;
- document every implemented schema clearly in `README.md` and/or `docs/DATA_SCHEMA.md`;
- create 20–30 fictional starter people and relationships that exercise the edge cases listed above;
- omit photos from the synthetic dataset;
- implement all four requested exploration views;
- implement responsive desktop/mobile behavior;
- include the Node 22 Dev Container configuration;
- add appropriate domain tests;
- run the application;
- run the tests;
- run the production build;
- fix issues found during testing;
- keep genealogy calculations client-side after authenticated loading, with server-only private data and media boundaries;
- do not add services or dependencies that are not necessary.

When reporting meaningful changes, provide a concise summary of:

1. what was built;
2. important architectural decisions;
3. how the data files are structured;
4. how to run the project;
5. how to replace the synthetic data with private family data;
6. any limitations or sensible candidates for a future V2.
