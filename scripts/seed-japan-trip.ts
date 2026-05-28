import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db/client";
import {
  emergencyPhraseCategories,
  emergencyPhrases,
  trips,
} from "../src/lib/db/schema";
import { DEFAULT_PHRASE_CATEGORIES } from "../src/lib/phrases/default-phrases";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function randomCode(len: number) {
  // URL-safe-ish base16, good enough for seed script.
  return randomBytes(Math.ceil(len / 2))
    .toString("hex")
    .slice(0, len);
}

async function main() {
  // Ensure it's obvious when someone runs this without DB configured.
  requiredEnv("DATABASE_URL");

  const inviteCode = process.env.INVITE_CODE ?? randomCode(6);
  const hostCode = process.env.HOST_CODE ?? randomCode(8);

  const hostCodeHash = await bcrypt.hash(hostCode, 10);

  const [trip] = await db
    .insert(trips)
    .values({
      name: "Japan School Trip",
      schoolName: "Example School",
      inviteCode,
      hostCodeHash,
      startDate: "2026-07-16",
      endDate: "2026-07-23",
      destinationCountry: "Japan",
      destinationLanguage: "ja",
      timezone: "Asia/Tokyo",
      defaultCountryCallingCode: "NZ",
      publishedVersion: 0,
    })
    .returning();

  if (!trip) throw new Error("Failed to insert trip");

  let sortOrder = 0;
  for (const cat of DEFAULT_PHRASE_CATEGORIES) {
    const [insertedCategory] = await db
      .insert(emergencyPhraseCategories)
      .values({
        tripId: trip.id,
        name: cat.name,
        sortOrder: sortOrder++,
      })
      .returning();

    if (!insertedCategory) throw new Error(`Failed inserting category ${cat.name}`);

    let phraseSort = 0;
    for (const p of cat.phrases) {
      await db.insert(emergencyPhrases).values({
        tripId: trip.id,
        categoryId: insertedCategory.id,
        englishText: p.english,
        translatedText: p.translated,
        pronunciation: p.pronunciation,
        source: "default",
        sortOrder: phraseSort++,
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log("Seeded trip:", {
    tripId: trip.id,
    inviteCode,
    hostCode,
    note: "Save the hostCode somewhere safe; only the hash is stored.",
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

