export const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders });
