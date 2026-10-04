# PROJECT_SCOPE.md

## Project Overview

Build a responsive, read-only React web application for exploring family-tree information stored in repository-managed JSON files.

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
10. Be straightforward to deploy as a static site, such as on Vercel.
11. Keep the generic application suitable for public/open-source release while allowing real family data to remain private.
12. Keep the underlying family-data schema easy for a technically comfortable person to edit manually.

---

## Explicit Non-Goals for V1

Do **not** add the following unless required for a core V1 feature:

- in-browser data editing;
- user accounts;
- multi-user collaboration;
- a backend API;
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
- Vite
- React Flow / `@xyflow/react` for graph rendering
- ELK / `elkjs` for automatic graph layout where useful
- client-side state only
- JSON files as the family-data source of truth

Avoid unnecessary dependencies.

The entire V1 must run client-side after build.

No external services should be required to view or navigate family data.

---

## Architectural Principles

### 1. Separate genealogy data from visualization data

The family-data model must **not** use React Flow node/edge objects as its persistent format.

Create a clear transformation layer:

```text
Family JSON
    |
    v
Genealogy/domain model
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

The exact TypeScript implementation may evolve, but V1 should conform to the following conceptual schema.

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

Places may be represented as plain strings in V1.

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

Store photo files separately.

Where no photo is available, render a clean fallback avatar using initials or another neutral treatment.

Do not require photos in the synthetic starter dataset.

---

# Relationship Schema

Relationships are first-class records stored independently from people.

Suggested structure:

```json
{
  "id": "r0037",
  "person1": "p0012",
  "person2": "p0041",
  "type": "biological_parent",
  "confidence": "confirmed"
}
```

The implementation may choose clearer directional field names for parent relationships if this reduces ambiguity, for example:

```json
{
  "id": "r0037",
  "from": "p0041",
  "to": "p0012",
  "type": "biological_parent"
}
```

Whichever approach is selected must be:

- unambiguous;
- consistent;
- documented;
- easy to edit manually.

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

Load the complete family dataset into memory at startup.

Do not add:

- pagination;
- server-side graph queries;
- database indexing;
- lazy network retrieval;
- backend caching.

Graph operations on this scale should be client-side.

Avoid unnecessary React rerenders, particularly around React Flow.

---

# Runtime Validation

Validate family data at startup.

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
- provide a clear developer-facing message identifying the relevant record and problem.

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

The starter dataset should make the app useful immediately after cloning and starting the development server.

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

If implementing the two-repository pattern fully would overcomplicate V1, structure the data-loading layer so that it can be swapped later without major UI changes.

Document the recommended approach for private deployment.

Do not rely on accidentally ignored sensitive files as the primary long-term privacy strategy.

---

# Deployment

The app should build as a static client-side site suitable for:

- Vercel;
- Netlify;
- Cloudflare Pages;
- equivalent static hosting.

Do not require a server process after build.

Document:

```text
npm install
npm run dev
npm run build
npm run preview
```

and any deployment-specific considerations.

---

# Dev Container

Include an appropriate VS Code Dev Container configuration.

Use a standard Node.js development container suitable for React/Vite/TypeScript development.

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
- expose or forward the Vite development port;
- work in VS Code Dev Containers without additional manual setup;
- avoid unnecessary features and packages.

Do not create a heavyweight Docker setup when a standard devcontainer image is sufficient.

Document Dev Container usage briefly in the README.

---

# Suggested Repository Structure

A reasonable starting structure is:

```text
.
├── .devcontainer/
│   └── devcontainer.json
├── docs/
│   └── DATA_SCHEMA.md
├── public/
│   └── photos/
├── src/
│   ├── components/
│   │   ├── FamilyGraph/
│   │   ├── PersonNode/
│   │   ├── PersonPanel/
│   │   ├── PersonSearch/
│   │   └── RelationshipPath/
│   ├── data/
│   │   ├── people.json
│   │   └── relationships.json
│   ├── domain/
│   │   ├── types.ts
│   │   ├── validation.ts
│   │   ├── genealogy.ts
│   │   ├── relationships.ts
│   │   └── kinship.ts
│   ├── views/
│   │   ├── HomeView/
│   │   ├── ImmediateFamilyView/
│   │   ├── AncestorView/
│   │   ├── DescendantView/
│   │   └── RelationshipView/
│   └── ...
├── README.md
├── PROJECT_SCOPE.md
├── package.json
└── ...
```

This structure is guidance, not a rigid requirement.

Prefer clear organization over preserving this exact tree.

If events are stored in a separate `events.json` file rather than nested under people, document that decision clearly.

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

Also run the application manually and verify responsive behavior at representative desktop and mobile widths.

---

# README Requirements

Create a polished `README.md`.

It should include:

- what the project is;
- why it exists;
- screenshots or placeholders may be added later;
- main features;
- local development instructions;
- Dev Container instructions;
- build instructions;
- deployment overview;
- data-file overview;
- prominent link to full schema documentation;
- explanation of synthetic starter data;
- explanation of how private family data should be kept separate;
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
3. Synthetic starter data loads without errors.
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
23. No backend or unnecessary service dependency has been added.
24. No real family information is included in the public starter project.

---

# Codex Task

Build the complete V1 described in this file.

Treat this document as the source of truth for product scope.

Use reasonable implementation judgment where a low-level detail is not specified, but do not expand the product beyond the stated scope.

In particular:

- create the React/Vite/TypeScript application;
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
- keep the application entirely client-side;
- do not add services or dependencies that are not necessary.

When implementation is complete, provide a concise summary of:

1. what was built;
2. important architectural decisions;
3. how the data files are structured;
4. how to run the project;
5. how to replace the synthetic data with private family data;
6. any limitations or sensible candidates for a future V2.
