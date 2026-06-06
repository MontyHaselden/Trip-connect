import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

export async function savePhotoBuffer(params: {
  tripId: string;
  buffer: Buffer;
  extension: string;
}): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  const dir = path.join(process.cwd(), "public", "uploads", params.tripId);
  await mkdir(dir, { recursive: true });
  const id = randomBytes(8).toString("hex");
  const filename = `${id}.${params.extension}`;
  const fullPath = path.join(dir, filename);
  await writeFile(fullPath, params.buffer);
  const url = `/uploads/${params.tripId}/${filename}`;
  return { imageUrl: url, thumbnailUrl: url };
}
