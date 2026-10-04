import { useState } from "react";
import {
  displayName,
  initials,
  lifespan,
  formatDate,
} from "../domain/genealogy";
import { confidence, type Confidence, type Person } from "../domain/types";
import { Icon } from "./Icons";

export function Avatar({
  person,
  large = false,
}: {
  person: Person;
  large?: boolean;
}) {
  const photo = person.photos.find((p) => p.primary) ?? person.photos[0];
  const [failed, setFailed] = useState<string | null>(null);
  const tone = [...person.id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 4;
  return (
    <span className={`avatar tone-${tone} ${large ? "large" : ""}`}>
      {photo && failed !== photo.file ? (
        <img
          src={`${import.meta.env.BASE_URL}photos/${photo.file}`}
          alt={`${displayName(person)}${photo.label ? `, ${photo.label}` : ""}`}
          onError={() => setFailed(photo.file)}
        />
      ) : (
        <span aria-label={`Initials of ${displayName(person)}`}>
          {initials(person)}
        </span>
      )}
    </span>
  );
}
export function ConfidenceBadge({ value }: { value?: Confidence }) {
  return confidence(value) === "confirmed" ? null : (
    <span className={`confidence ${value}`} title={`Confidence: ${value}`}>
      ◇ {value}
    </span>
  );
}
export function PersonCard({
  person,
  onClick,
  caption,
}: {
  person: Person;
  onClick: () => void;
  caption?: string;
}) {
  return (
    <button className="person-card" onClick={onClick}>
      <Avatar person={person} />
      <span>
        <strong>{displayName(person)}</strong>
        <small>{caption ?? lifespan(person)}</small>
      </span>
      <Icon name="chevron" size={16} />
    </button>
  );
}
export function PersonPanel({ person }: { person: Person }) {
  const name = displayName(person);
  return (
    <aside className="person-panel" aria-label={`Profile of ${name}`}>
      <div className="profile-header">
        <span className="eyebrow">A LIFE IN THE FAMILY</span>
        <Avatar key={person.id} person={person} large />
        <h2>{name}</h2>
        <p>{lifespan(person)}</p>
      </div>
      {person.names.length > 1 && (
        <div className="other-names">
          {person.names
            .filter(
              (n) => [n.given, n.surname].filter(Boolean).join(" ") !== name,
            )
            .map((n, i) => (
              <p key={i}>
                <span>{n.type} name</span>
                {[n.given, n.surname].filter(Boolean).join(" ")}
              </p>
            ))}
        </div>
      )}
      <section className="profile-section">
        <h3>Life details</h3>
        {(["birth", "death"] as const).map((type) => {
          const fact = person[type];
          if (type === "death" && !fact) return null;
          return (
            <div className="life-fact" key={type}>
              <Icon name="calendar" size={17} />
              <div>
                <small>{type === "birth" ? "Born" : "Died"}</small>
                <p>
                  {formatDate(fact?.date)}{" "}
                  <ConfidenceBadge value={fact?.date?.confidence} />
                </p>
                {fact?.place && (
                  <p className="place">
                    {fact.place.value}{" "}
                    <ConfidenceBadge value={fact.place.confidence} />
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </section>
      <section className="profile-section">
        <h3>
          Life events <span>{person.events.length}</span>
        </h3>
        {person.events.length ? (
          <ol className="timeline">
            {person.events.map((event, i) => (
              <li key={i}>
                <small>
                  {event.date ? formatDate(event.date) : "Date not recorded"}{" "}
                  <ConfidenceBadge value={event.date?.confidence} />
                </small>
                <strong>{event.type}</strong>
                {event.label && <p>{event.label}</p>}
                {event.place && (
                  <p>
                    {event.place.value}{" "}
                    <ConfidenceBadge value={event.place.confidence} />
                  </p>
                )}
                <ConfidenceBadge value={event.confidence} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-copy">There are no life events recorded yet.</p>
        )}
      </section>
      {person.photos.length > 0 && (
        <section className="profile-section">
          <h3>Portraits</h3>
          <div className="portraits">
            {person.photos.map((photo) => (
              <figure key={photo.file}>
                <img
                  src={`${import.meta.env.BASE_URL}photos/${photo.file}`}
                  alt={`${name}${photo.label ? `, ${photo.label}` : ""}`}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <figcaption>
                  {photo.label ?? "Portrait"}
                  {photo.date && ` · ${formatDate(photo.date)}`}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      <div className="record-note">
        <Icon name="book" size={16} />
        <span>
          Every detail is a piece of the story.
          <br />
          Unrecorded facts remain unknown.
        </span>
      </div>
    </aside>
  );
}
