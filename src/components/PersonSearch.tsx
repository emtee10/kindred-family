import { useState, useRef, useId, useEffect } from "react";
import { Genealogy, displayName, lifespan } from "../domain/genealogy";
import { Avatar } from "./PersonUI";
import { Icon } from "./Icons";

export function PersonSearch({
  family,
  onSelect,
  prominent = false,
}: {
  family: Genealogy;
  onSelect: (id: string) => void;
  prominent?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null),
    id = useId();
  const results = family.search(query);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);
  const choose = (personId: string) => {
    onSelect(personId);
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };
  return (
    <div
      className={`search-wrap ${prominent ? "prominent" : ""}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <div className="search-field">
        <Icon name="search" />
        <input
          ref={input}
          aria-label="Search all family names"
          placeholder={
            prominent ? "Find someone in the family…" : "Search family…"
          }
          role="combobox"
          aria-expanded={open}
          aria-controls={id}
          aria-autocomplete="list"
          aria-activedescendant={
            open && results[active] ? `${id}-${active}` : undefined
          }
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) =>
                Math.max(0, Math.min(a + 1, results.length - 1)),
              );
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            }
            if (e.key === "Enter" && open && results[active]) {
              e.preventDefault();
              choose(results[active].id);
            }
          }}
        />
        {prominent && (
          <button
            className="search-go"
            aria-label="Show search results"
            onClick={() => {
              input.current?.focus();
              setOpen(true);
            }}
          >
            <Icon name="arrow" />
          </button>
        )}
      </div>
      {open && (
        <div
          className="search-results"
          id={id}
          role="listbox"
          aria-label="Matching family members"
        >
          {results.length ? (
            results.map((person, i) => (
              <button
                role="option"
                aria-selected={i === active}
                id={`${id}-${i}`}
                key={person.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(person.id)}
              >
                <Avatar person={person} />
                <span>
                  <strong>{displayName(person)}</strong>
                  <small>{lifespan(person)}</small>
                </span>
              </button>
            ))
          ) : (
            <p>No matching names. Try a birth name or nickname.</p>
          )}
        </div>
      )}
    </div>
  );
}
