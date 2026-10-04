import people from "./people.json";
import relationships from "./relationships.json";
import { validateFamily } from "../domain/validation";
import { Genealogy } from "../domain/genealogy";

// Swap these two imports at build time to use a separate private data repository.
export function loadFamily() {
  return new Genealogy(validateFamily(people, relationships));
}
