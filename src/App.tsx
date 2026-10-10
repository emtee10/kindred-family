import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { Genealogy, displayName, edgeLabel } from "./domain/genealogy";
import { kinship } from "./domain/kinship";
import type { ArchiveConfig } from "./data/types";
import { signOut } from "next-auth/react";
import { type View } from "./components/FamilyGraph";
import {
  Avatar,
  PersonCard,
  PersonPanel,
  ConfidenceBadge,
} from "./components/PersonUI";
import { PersonSearch } from "./components/PersonSearch";
import { Icon } from "./components/Icons";

const FamilyGraph = lazy(() =>
  import("./components/FamilyGraph").then((module) => ({
    default: module.FamilyGraph,
  })),
);

const views: { id: View; name: string; icon: string; description: string }[] = [
  {
    id: "family",
    name: "Immediate family",
    icon: "family",
    description:
      "The people closest to you. Parents, siblings, partners, and children.",
  },
  {
    id: "ancestors",
    name: "Ancestors",
    icon: "ancestors",
    description:
      "Follow the branches back. Discover the generations that came before.",
  },
  {
    id: "descendants",
    name: "Descendants",
    icon: "descendants",
    description:
      "See how a family grows. Follow each generation into the next.",
  },
  {
    id: "path",
    name: "Relationships",
    icon: "path",
    description: "Find the connection. Trace the path between any two people.",
  },
];
export default function App({ family, config }: { family: Genealogy; config: ArchiveConfig }) {
  const initial =
    config.featured.find((id) => family.people.has(id)) ??
    family.data.people[0].id;
  const [home, setHome] = useState(true),
    [root, setRoot] = useState(initial),
    [selected, setSelected] = useState(initial),
    [view, setView] = useState<View>("family"),
    [generations, setGenerations] = useState(3),
    [target, setTarget] = useState(
      family.people.has("finn")
        ? "finn"
        : (family.data.people.find((p) => p.id !== initial)?.id ?? initial),
    );
  const explore = useCallback((id: string) => {
    setRoot(id);
    setSelected(id);
    setHome(false);
  }, []);
  const selectNode = useCallback(
    (id: string) => {
      setSelected(id);
      if (view !== "path") setRoot(id);
    },
    [view],
  );
  const person = family.people.get(root)!;
  const artPeople = [
    family.parents(root)[0],
    family.parents(root)[1],
    family.children(root)[0],
    family.children(root)[1],
  ].map((id) => family.people.get(id));
  const featured = config.featured.filter((id) => family.people.has(id));
  const generationCount = useMemo(
    () =>
      Math.max(
        ...family.data.people.map(
          (p) =>
            Math.max(
              ...family
                .traverse(p.id, "ancestors", family.data.people.length)
                .values(),
            ) + 1,
        ),
      ),
    [family],
  );
  const label = view === "path" ? kinship(family, root, target) : null;
  const path = view === "path" ? family.path(root, target) : null;
  return (
    <div className="app">
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => setHome(true)}
            aria-label={`${config.title} home`}
          >
            <span className="brand-symbol">
              <Icon name="leaf" size={24} />
            </span>
            <span>
              {config.title}
              <small>THE FAMILY ARCHIVE</small>
            </span>
          </button>
          <nav aria-label="Primary navigation">
            <button
              className={home ? "active" : ""}
              onClick={() => setHome(true)}
            >
              Overview
            </button>
            <button
              className={!home ? "active" : ""}
              onClick={() => setHome(false)}
            >
              Explore family
            </button>
          </nav>
          <div className="header-search">
            <PersonSearch family={family} onSelect={explore} />
          </div>
          {config.isDemo && (
            <span className="demo-badge">
              <span />
              Fictional demo
            </span>
          )}
        </div>
      </header>
      {home ? (
        <main className="home">
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="tiny-line" />
                EVERY BRANCH HAS A STORY
              </span>
              <h1>
                A family, connected.
                <br />
                <em>A story, shared.</em>
              </h1>
              <p>
                Discover the people, places, and connections that make a family.
                Start with a name and see where the branches lead.
              </p>
              <PersonSearch family={family} onSelect={explore} prominent />
              <div className="search-hint">
                {config.isDemo
                  ? "Try a name from the fictional starter family."
                  : "Search a current, former, or birth name."}
              </div>
            </div>
            <div className="hero-art" aria-label="A glimpse of the family">
              <div className="art-ring ring-one" />
              <div className="art-ring ring-two" />
              <svg
                className="art-connectors"
                viewBox="0 0 500 370"
                aria-hidden="true"
              >
                <path d="M140 100H370M255 100V208M255 208V298M135 298H370M135 298V310M370 298V310" />
              </svg>
              <div className="mini-node mini-one">
                {artPeople[0] ? (
                  <PersonCard
                    person={artPeople[0]}
                    onClick={() => explore(artPeople[0]!.id)}
                  />
                ) : (
                  <div className="unknown-relative">Parent not recorded</div>
                )}
              </div>
              <div className="mini-node mini-two">
                {artPeople[1] ? (
                  <PersonCard
                    person={artPeople[1]}
                    onClick={() => explore(artPeople[1]!.id)}
                  />
                ) : (
                  <div className="unknown-relative">Parent not recorded</div>
                )}
              </div>
              <div className="mini-node mini-center">
                <PersonCard person={person} onClick={() => explore(root)} />
                <span className="art-label">A place to begin</span>
              </div>
              <div className="mini-node mini-three">
                {artPeople[2] ? (
                  <PersonCard
                    person={artPeople[2]}
                    onClick={() => explore(artPeople[2]!.id)}
                  />
                ) : (
                  <div className="unknown-relative">Child not recorded</div>
                )}
              </div>
              <div className="mini-node mini-four">
                {artPeople[3] ? (
                  <PersonCard
                    person={artPeople[3]}
                    onClick={() => explore(artPeople[3]!.id)}
                  />
                ) : (
                  <div className="unknown-relative">Child not recorded</div>
                )}
              </div>
              <span className="art-note">
                <Icon name="leaf" size={15} />
                Many lives. One connected story.
              </span>
            </div>
          </section>
          <div className="archive-strip">
            <span>
              <Icon name="family" />
              <strong>{family.data.people.length}</strong> family members
            </span>
            <span>
              <Icon name="ancestors" />
              <strong>{generationCount}</strong> generations to discover
            </span>
            <span>
              <Icon name="book" />
              Made for the stories we share
            </span>
          </div>
          <section className="explore-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">FOLLOW YOUR CURIOSITY</span>
                <h2>There’s more than one way to explore.</h2>
              </div>
              <p>One family. A few different perspectives.</p>
            </div>
            <div className="view-cards">
              {views.map((item) => (
                <button
                  key={item.id}
                  className="view-card"
                  onClick={() => {
                    setView(item.id);
                    explore(root);
                  }}
                >
                  <span className={`view-icon ${item.id}`}>
                    <Icon name={item.icon} size={25} />
                  </span>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <span className="card-action">
                    Explore <Icon name="arrow" size={17} />
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section className="featured-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">MEET THE FAMILY</span>
                <h2>A few familiar starting points.</h2>
              </div>
              <span className="subtle-label">
                {config.isDemo
                  ? "From our fictional starter family"
                  : "Choose a person to begin"}
              </span>
            </div>
            <div className="featured-people">
              {(featured.length
                ? featured
                : family.data.people.slice(0, 4).map((p) => p.id)
              ).map((id) => (
                <PersonCard
                  key={id}
                  person={family.people.get(id)!}
                  onClick={() => {
                    setView("family");
                    explore(id);
                  }}
                />
              ))}
            </div>
          </section>
          <div className="home-note">
            <Icon name="leaf" />
            <p>
              {config.subtitle}
              <span>
                Some details are known. Others are still a question. Both belong
                in the family story.
              </span>
            </p>
          </div>
        </main>
      ) : (
        <main className="explorer">
          <div className="explorer-heading">
            <div>
              <button className="back-link" onClick={() => setHome(true)}>
                ← Back to overview
              </button>
              <h1>
                {view === "path" ? "Find a connection" : displayName(person)}
                <span>
                  {view === "path"
                    ? "Every connection has a path."
                    : "Follow a branch. Get to know the family."}
                </span>
              </h1>
            </div>
            <span className="member-count">
              {family.data.people.length} people in this archive
            </span>
          </div>
          <div className="explorer-toolbar">
            <div
              className="view-tabs"
              role="group"
              aria-label="Exploration view"
            >
              {views.map((item) => (
                <button
                  key={item.id}
                  aria-pressed={view === item.id}
                  className={view === item.id ? "selected" : ""}
                  onClick={() => setView(item.id)}
                >
                  <Icon name={item.icon} size={17} />
                  {item.name}
                </button>
              ))}
            </div>
            {(view === "ancestors" || view === "descendants") && (
              <label className="generation-select">
                Show{" "}
                <select
                  value={generations}
                  onChange={(e) => setGenerations(Number(e.target.value))}
                >
                  {[2, 3, 4, 5].map((n) => (
                    <option value={n} key={n}>
                      {n} generations
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {view === "path" && (
            <div className="path-controls">
              <label>
                From
                <select value={root} onChange={(e) => explore(e.target.value)}>
                  {family.search("").map((p) => (
                    <option value={p.id} key={p.id}>
                      {displayName(p)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="swap-button"
                aria-label="Swap relationship endpoints"
                onClick={() => {
                  setRoot(target);
                  setTarget(root);
                  setSelected(target);
                }}
              >
                ⇄
              </button>
              <label>
                To
                <select
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setSelected(e.target.value);
                  }}
                >
                  {family.search("").map((p) => (
                    <option value={p.id} key={p.id}>
                      {displayName(p)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="path-summary" aria-live="polite">
                {label ? (
                  <>
                    <strong>
                      {label === "same person"
                        ? "The same person"
                        : `${displayName(family.people.get(target)!)} is ${displayName(person)}’s ${label}.`}
                    </strong>
                    <small>
                      {path?.edges.length} recorded connection
                      {path?.edges.length === 1 ? "" : "s"}
                    </small>
                  </>
                ) : (
                  <>
                    <strong>
                      {path
                        ? "Connected through the family"
                        : "No recorded connection"}
                    </strong>
                    <small>
                      {path
                        ? "Follow the labeled path for the exact relationships."
                        : "Try choosing a different person."}
                    </small>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="explorer-body">
            <section className="graph-section">
              <div className="graph-heading">
                <span>
                  <Icon
                    name={views.find((v) => v.id === view)!.icon}
                    size={18}
                  />
                  {views.find((v) => v.id === view)!.name}
                </span>
                <small>
                  {view === "path"
                    ? "Select a person to see their profile"
                    : "Select a person to explore their family"}
                </small>
              </div>
              <Suspense
                fallback={
                  <div className="graph-message" role="status">
                    Loading the family view…
                  </div>
                }
              >
                <FamilyGraph
                  family={family}
                  root={root}
                  selected={selected}
                  target={target}
                  view={view}
                  generations={generations}
                  onSelect={selectNode}
                />
              </Suspense>
              <div className="graph-footer">
                <span>Drag to pan · Scroll or pinch to zoom</span>
                <span>
                  {view === "family"
                    ? "One person. Their closest connections."
                    : view === "path"
                      ? "Shortest path through recorded relationships."
                      : `Up to ${generations} generations · all parent types included`}
                </span>
              </div>
            </section>
            <PersonPanel person={family.people.get(selected)!} />
          </div>
          <section className="accessible-family">
            <h2>
              {view === "path" ? "People on this path" : "People in this view"}
            </h2>
            <p>A list for easy keyboard navigation.</p>
            <div role="list">
              {[
                ...(view === "family"
                  ? family.immediate(root)
                  : view === "path"
                    ? (path?.people ?? [])
                    : family.traverse(root, view, generations).keys()),
              ].map((id, index) => (
                <span className="path-entry" role="listitem" key={id}>
                  <button onClick={() => selectNode(id)}>
                    <Avatar person={family.people.get(id)!} />
                    {displayName(family.people.get(id)!)}
                  </button>
                  {view === "path" && path?.edges[index] && (
                    <span className="path-link">
                      {edgeLabel(path.edges[index], id)}{" "}
                      <ConfidenceBadge value={path.edges[index].confidence} />
                      <Icon name="arrow" size={15} />
                    </span>
                  )}
                </span>
              ))}
            </div>
          </section>
        </main>
      )}
      <footer className="site-footer">
        <span>
          <Icon name="leaf" size={16} />
          {config.title} <span className="footer-dot">·</span> A place for your
          family story.
        </span>
        <small>
          {config.isDemo
            ? "Fictional people. Real possibilities."
            : "A family archive, thoughtfully kept."}
        </small>
        <button className="logout-button" onClick={() => signOut({ callbackUrl: "/login" })}>Log out</button>
      </footer>
    </div>
  );
}
