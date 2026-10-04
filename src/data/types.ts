import type { FamilyData } from "../domain/types";
export interface ArchiveConfig {
  title: string;
  subtitle: string;
  isDemo: boolean;
  featured: string[];
}
export interface ArchiveData extends FamilyData { config: ArchiveConfig }
