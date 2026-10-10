import { auth } from "../../../auth";
import { loadFamilyData } from "../../../server/family-data";
import { privateHeaders, unauthorized } from "../../../server/responses";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await auth())?.user) return unauthorized();
  try { return Response.json(await loadFamilyData(), { headers: privateHeaders }); }
  catch (error) {
    // Validation details are available only inside the authenticated archive.
    return Response.json({ error: error instanceof Error ? error.message : "The family records need attention." }, { status: 500, headers: privateHeaders });
  }
}
