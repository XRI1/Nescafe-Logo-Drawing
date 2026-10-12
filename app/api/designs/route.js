import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createDesign, getLatestDesigns } from "@/lib/design-store";
import { publishDesign } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const globalForLimits = globalThis;
const uploadLimits = globalForLimits.__nescafeUploadLimits || new Map();
globalForLimits.__nescafeUploadLimits = uploadLimits;
const uploadDirectory = () => process.env.UPLOAD_DIRECTORY || path.join(process.cwd(), "uploads");
const maxUploadBytes = () => Number(process.env.MAX_UPLOAD_BYTES || 2 * 1024 * 1024);

function clientIp(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

function withinRateLimit(request) {
  const now = Date.now();
  const ip = clientIp(request);
  const recent = (uploadLimits.get(ip) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 12) return false;
  recent.push(now);
  uploadLimits.set(ip, recent);
  return true;
}

function readPngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature) || buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  let offset = 8;
  let foundEnd = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) return null;
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "IEND") {
      foundEnd = length === 0 && end === buffer.length;
      break;
    }
    offset = end;
  }
  if (!foundEnd) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export async function GET(request) {
  try {
    const requested = Number(new URL(request.url).searchParams.get("limit") || 10);
    const limit = Math.max(1, Math.min(50, Number.isFinite(requested) ? requested : 10));
    const designs = await getLatestDesigns(limit);
    return NextResponse.json({ designs }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to read designs", error);
    return NextResponse.json({ error: "Unable to load designs" }, { status: 500 });
  }
}

export async function POST(request) {
  if (!withinRateLimit(request)) return NextResponse.json({ error: "Too many uploads. Please wait a moment." }, { status: 429 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Upload must use multipart/form-data" }, { status: 415 });
  }
  let storedPath;
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) return NextResponse.json({ error: "A PNG image is required" }, { status: 400 });
    if (file.size <= 0 || file.size > maxUploadBytes()) return NextResponse.json({ error: "PNG exceeds the upload limit" }, { status: 413 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const dimensions = readPngDimensions(buffer);
    if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 4096 || dimensions.height > 4096) return NextResponse.json({ error: "Invalid PNG image" }, { status: 400 });

    const id = crypto.randomUUID();
    const filename = `${id}.png`;
    const directory = uploadDirectory();
    storedPath = path.join(directory, filename);
    await fs.mkdir(directory, { recursive: true });
    const temporaryPath = `${storedPath}.tmp`;
    await fs.writeFile(temporaryPath, buffer, { flag: "wx" });
    await fs.rename(temporaryPath, storedPath);

    const design = await createDesign({ id, imageUrl: `/uploads/${filename}`, width: dimensions.width, height: dimensions.height, fileSize: buffer.length });
    publishDesign(design);
    return NextResponse.json(design, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (storedPath) await fs.unlink(storedPath).catch(() => {});
    console.error("Failed to save design", error);
    return NextResponse.json({ error: "Unable to save design" }, { status: 500 });
  }
}
