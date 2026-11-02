import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { LoginForm } from "./LoginForm";
import { ThemeToggle } from "../../components/ThemeToggle";
export default async function LoginPage() {
  if ((await auth())?.user) redirect("/");
  return <main className="login-page"><div className="login-theme"><ThemeToggle /></div><section className="login-card"><span className="eyebrow">THE FAMILY ARCHIVE</span><h1>Kindred</h1><p>Enter the family password to explore the archive.</p><LoginForm /></section></main>;
}
