import { auth } from "../../../../auth";
import { readPhoto } from "../../../../server/photos";
import { privateHeaders, unauthorized } from "../../../../server/responses";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string[] }> }) {
  if (!(await auth())?.user) return unauthorized();
  const photo = await readPhoto((await params).filename);
  if (!photo) return new Response(null, { status: 404, headers: privateHeaders });
  return new Response(new Uint8Array(photo.bytes), { headers: { ...privateHeaders, "Content-Type": photo.contentType } });
}
