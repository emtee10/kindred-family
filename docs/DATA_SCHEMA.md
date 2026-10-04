# Family data guide

Kindred stores people and relationships separately. The JSON describes genealogy, never graph positions. The server loads and validates the JSON only after authentication; the client validates the received records before the interface renders. The Next.js migration preserves the existing person, relationship, event, date, and photo record formats. Errors identify the file collection, record index, ID where available, and offending field. Unsupported fields are rejected to catch misspellings.

## Files

| File | Contents |
| --- | --- |
| `private-data/people.json` | Server-only array of person records, including structured events |
| `private-data/relationships.json` | Server-only array of relationship records |
| `private-data/config.ts` | Server-only application title, subtitle, `isDemo` indicator, and featured person IDs |
| `private-media/` | Private portrait files; never embed images in JSON |
| `src/server/family-data.ts` | Server-only JSON loading and validation for `/api/family-data` |
| `src/server/photos.ts` | Server-only photo validation and reading for `/api/photos/[...filename]` |
| `src/data/types.ts` | Shared TypeScript archive types, with no family records |

Neither private directory is directly routable. Both API routes independently require an Auth.js session and return private, non-cacheable responses. Never place family JSON or photographs in `public/`, and never import private records or configuration into Client Components.

Use stable, unique, nonempty string IDs, for example `p0012` or `elara`. Once assigned, do not change an ID when a person changes their name. People and relationships each have their own ID namespace. The dataset must contain at least one person. No particular person ID is required by the app.

## Person records

Only `id` and `names` are required. Optional unknown facts can be omitted or set to `null`. Omitted `events` and `photos` become empty arrays; these arrays themselves cannot be null. Omitting death information means **death is not recorded**, rather than proof that someone is alive.

```json
{
  "id": "p0012",
  "names": [
    { "given": "Elara", "surname": "Willowmere", "type": "current" },
    { "given": "Ellie", "type": "nickname" }
  ],
  "sex": "female",
  "birth": {
    "date": { "value": "1975-05-18", "qualifier": "exact" },
    "place": { "value": "Willow Quay" }
  },
  "death": null,
  "events": [],
  "photos": []
}
```

| Field            | Format                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `id`             | Required nonempty stable string                                                                       |
| `names`          | Required nonempty array of name records                                                               |
| `sex`            | Optional `female`, `male`, `other`, `unknown`, or null; does not create or determine any relationship |
| `birth`, `death` | Optional object with independently optional/null `date` and `place`, or null                          |
| `events`         | Optional array of predefined structured events                                                        |
| `photos`         | Optional array of zero to three portraits                                                             |

An empty `death: {}` records a known death with unknown date/place. Birth and death are first-class facts; they are not generic events. The UI displays unknown birth dates clearly and does not infer facts from missing fields.

### Names

Each name requires a nonempty `given` string and `type`; `surname` is an optional string. The controlled types are `current`, `birth`, `former`, `alternate`, `nickname`. Display uses the first `current` name, otherwise the first non-nickname name, otherwise the first name. Put the preferred current name first if there is more than one. Search matches every name, ignoring case and accents, and allows several space-separated terms within one name record.

To change a name, retain the ID, mark the old name as `birth` or `former`, and add a `current` entry. To add a nickname or alternate name, append a name with that type. No narrative explanation is needed.

## Confidence

Confidence is optional and defaults to `confirmed`. Valid values, from strongest to weakest:

`confirmed` · `probable` · `possible` · `speculative`

Date and place confidence are independent. Events and relationships also accept confidence. Uncertain facts have text badges; uncertain graph edges have both dashed lines and explicit confidence labels. Confirmed edges use solid lines. Absence of confidence describes confidence only, not a claim that an unknown fact is known.

To add an uncertain fact:

```json
{
  "date": { "value": "1884", "qualifier": "about", "confidence": "probable" },
  "place": { "value": "Briar Hollow", "confidence": "possible" }
}
```

## Dates and places

Single dates use `{ "value": "YYYY[-MM[-DD]]", "qualifier": "exact" }`. Qualifier is optional and defaults to `exact`; it can also be `about`, `before`, or `after`. Calendar month/day values are validated, including leap years. Dates are formatted as strings, preserving date-only values without timezone shifts.

Ranges require `qualifier: "range"`, `start`, and `end`, and must have the start no later than the end. Do not include `value` on ranges or range fields on single dates. All date objects accept optional `confidence`.

```json
{ "value": "1942-05-18", "qualifier": "exact" }
```

```json
{ "value": "1942-05" }
```

```json
{ "value": "1942", "qualifier": "about", "confidence": "probable" }
```

```json
{ "value": "1890", "qualifier": "before" }
```

```json
{ "value": "1890", "qualifier": "after" }
```

```json
{ "start": "1910", "end": "1914", "qualifier": "range" }
```

These display as `18 May 1942`, `May 1942`, `c. 1942`, `before 1890`, `after 1890`, and `1910 – 1914`. Lifespan summaries use years and preserve approximate/before/after/range markers.

Places use `{ "value": "Fernhaven", "confidence": "possible" }`. `value` must be a nonempty string. No coordinates or external lookup are needed.

## Events

Each event requires `type`. Supported types: `marriage`, `divorce`, `residence`, `immigration`, `education`, `occupation`. Optional fields: `date`, `place`, `label` (a nonempty short structured value), `confidence`. Date/place may be null. Events are shown in the order stored; arrange them chronologically if desired.

```json
{
  "type": "occupation",
  "date": { "value": "2000" },
  "place": { "value": "Fernhaven" },
  "label": "Architect",
  "confidence": "confirmed"
}
```

Marriage/divorce events record life facts and do not create or delete relationships. Record spouse relationships separately. V1 has no dated partnership status, so a spouse edge may represent a former spouse; use divorce events to supply context. Do not add custom event types or biographies.

## Relationships

Every relationship requires `id`, `from`, `to`, and `type`. `confidence` is optional. Both endpoints must reference existing person IDs and must differ.

| Type                | Direction                                  |
| ------------------- | ------------------------------------------ |
| `biological_parent` | `from` is parent, `to` is child            |
| `adoptive_parent`   | `from` is adoptive parent, `to` is child   |
| `step_parent`       | `from` is step-parent, `to` is child       |
| `guardian`          | `from` is guardian, `to` is ward           |
| `spouse`            | Symmetric connection; order has no meaning |
| `partner`           | Symmetric connection; order has no meaning |

To add a relationship, append a record with a new unique ID:

```json
{
  "id": "r0037",
  "from": "p0041",
  "to": "p0012",
  "type": "biological_parent",
  "confidence": "possible"
}
```

All parent/guardian types participate in immediate, ancestor, and descendant views. Siblings are derived from shared parents; do not store sibling edges. Half-siblings require one shared biological parent and at least two recorded biological parents for both people. Shared non-biological parents yield a `Family sibling` label. Sparse parent records are not assumed to prove half-sibling status.

Shortest paths traverse all supported relationships in both directions, preserving the actual type and confidence. Traversals track visited IDs, so graph cycles and repeated ancestors cannot cause endless recursion. Generational views count connections from the selected root and show each person once at their shortest depth. Conventional kinship labels require a confirmed biological shortest route with an upward segment followed by a downward segment. Sibling/aunt/cousin labels additionally require two shared confirmed biological parents at the common branch. Other cases show the explicit path without claiming a conventional label. The path is one shortest route; equally short alternatives are not enumerated.

## Photos

Up to three portraits per person, with at most one primary photo. `file` is required: a relative path under `private-media/` with a `.jpg`, `.jpeg`, `.png`, `.webp`, or `.avif` extension. Optional fields: `label` (string), `primary` (boolean), `date` (date object or null). Paths cannot contain `..`, a leading slash, or a remote URL.

```json
{ "file": "p0012-1965.webp", "label": "1965", "primary": true }
```

To add a photo, place the file in `private-media/`, then append its record to the person's `photos` array. Primary photo is used on cards, otherwise the first photo. Missing or failed primary images use initials; profile galleries include captions. Alt text includes the person's name and optional label. Synthetic starter records deliberately contain no photos. The client requests images through the authenticated `/api/photos/[...filename]` route; for example, `portraits/p0012.webp` refers to `private-media/portraits/p0012.webp`. Use nonempty path segments containing letters, digits, underscores, hyphens, or dots, with no segment starting with a dot and no `..` anywhere. The route checks resolved filesystem containment, including symlinks, and returns 404 for missing or invalid files and 401 without authentication. Responses use `Cache-Control: private, no-store`. Rebuild and redeploy after adding photos on Vercel so runtime file tracing includes them.

## Add a person

1. Choose a new stable ID.
2. Append an object with that ID and at least one typed name to `private-data/people.json`.
3. Add known facts, events, and optional photos. Omit unknown facts.
4. Add relationships to `private-data/relationships.json`, always from parent to child for parent types.
5. Run `npm test`, `npm run typecheck`, and `npm run build` when working with synthetic data; sign in to the app to check runtime validation. Existing tests assert starter examples as well as isolated domain cases, so run those tests before replacing the starter dataset with real records in a private deployment workspace. Replacement JSON is validated on authenticated data loading, not by the production build alone.

Minimal example:

```json
{ "id": "p0099", "names": [{ "given": "Ash", "type": "current" }] }
```

See the [README](../README.md#deployment) for local secret setup, Vercel and Node.js deployment, private-data replacement, and session rotation. Keep the repository and deployment workspace containing real records private. JSON and media belong in the server deployment, never browser bundles or `public/`. Anyone with the shared password can download the complete dataset; this model does not provide individual authorization.
