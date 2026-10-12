import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const fallbackPath = path.join(process.cwd(), "data", "designs.json");
let fallbackWriteQueue = Promise.resolve();
const usesMySql = () => Boolean(process.env.DATABASE_URL);

async function readFallback() {
  try {
    const data = JSON.parse(await fs.readFile(fallbackPath, "utf8"));
    return Array.isArray(data.designs) ? data.designs.filter((item) => item.imageUrl) : [];
  } catch {
    return [];
  }
}

export async function getLatestDesigns(limit = 10) {
  if (usesMySql()) {
    const designs = await prisma.design.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return designs.reverse();
  }
  const designs = await readFallback();
  return designs.slice(-limit);
}

export async function createDesign(input) {
  if (usesMySql()) return prisma.design.create({ data: input });
  const design = { id: crypto.randomUUID(), ...input, createdAt: new Date().toISOString() };
  fallbackWriteQueue = fallbackWriteQueue.then(async () => {
    const designs = await readFallback();
    designs.push(design);
    await fs.mkdir(path.dirname(fallbackPath), { recursive: true });
    await fs.writeFile(fallbackPath, JSON.stringify({ designs }, null, 2));
  });
  await fallbackWriteQueue;
  return design;
}
