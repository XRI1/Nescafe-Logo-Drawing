import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

const dbPath = path.join(process.cwd(), "data", "designs.json");

export async function GET() {
  try { return NextResponse.json(JSON.parse(await fs.readFile(dbPath, "utf8"))); }
  catch { return NextResponse.json({ designs: [] }); }
}

export async function POST(request) {
  const body = await request.json();
  if (!body.image?.startsWith("data:image/png;base64,")) return NextResponse.json({ error: "Invalid design" }, { status: 400 });
  let db = { designs: [] };
  try { db = JSON.parse(await fs.readFile(dbPath, "utf8")); } catch {}
  const design = { id: crypto.randomUUID(), image: body.image, createdAt: new Date().toISOString() };
  db.designs.push(design);
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
  return NextResponse.json(design, { status: 201 });
}
