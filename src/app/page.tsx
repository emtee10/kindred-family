import { redirect } from "next/navigation";
import { auth } from "../auth";
import { FamilyClient } from "./FamilyClient";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  if (!(await auth())?.user) redirect("/login");
  return <FamilyClient />;
}
