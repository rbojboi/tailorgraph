import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth";
import { validatePhotoSize, validatePhotoType, validateUploadPath } from "@/lib/listing-upload-policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const started = Date.now();
  try {
    // No cookie-authenticated cross-origin token minting. This endpoint only
    // issues tokens; listing saves verify storage directly, without callbacks.
    if (request.headers.get("origin") !== new URL(request.url).origin ||
        !request.headers.get("content-type")?.startsWith("application/json")) {
      return Response.json({ error: "Invalid upload request origin." }, { status: 403 });
    }
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Sign in again to upload photos." }, { status: 401 });
    if (user.role !== "seller" && user.role !== "both") {
      return Response.json({ error: "A seller account is required." }, { status: 403 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return Response.json({ error: "Photo storage is unavailable. Please contact support." }, { status: 503 });
    }
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ error: "Upload request is too large." }, { status: 413 });
    const body = JSON.parse(raw) as HandleUploadBody;
    if (body?.type !== "blob.generate-client-token") {
      return Response.json({ error: "Invalid upload request." }, { status: 400 });
    }
    const response = await handleUpload({
      request, body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        validateUploadPath(pathname, user.id);
        const metadata = JSON.parse(clientPayload ?? "null");
        if (!metadata || typeof metadata !== "object") throw new Error("Invalid upload metadata.");
        validatePhotoSize(metadata.size);
        validatePhotoType(metadata.contentType);
        if ((pathname.endsWith(".png") ? "image/png" : "image/jpeg") !== metadata.contentType) {
          throw new Error("Photo extension does not match its content type.");
        }
        return {
          allowedContentTypes: [metadata.contentType],
          maximumSizeInBytes: metadata.size,
          validUntil: Date.now() + 15 * 60_000,
          addRandomSuffix: false,
          allowOverwrite: false
        };
      }
    });
    console.info(JSON.stringify({ event: "listing_upload_authorized", ms: Date.now() - started }));
    return Response.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Never log tokens, request payloads, or provider credentials.
    console.warn(JSON.stringify({ event: "listing_upload_rejected", ms: Date.now() - started }));
    return Response.json({ error: "Unable to authorize this photo. Use a JPG or PNG up to 25 MB, or sign in again." }, { status: 400 });
  }
}
