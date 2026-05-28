import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db/client";
import {
  emergencyPhraseCategories,
  emergencyPhrases,
  trips,
} from "../src/lib/db/schema";

type SeedCategory = {
  name: string;
  phrases: Array<{
    english: string;
    translated: string;
    pronunciation?: string;
  }>;
};

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

  const categories: SeedCategory[] = [
    {
      name: "Help",
      phrases: [
        {
          english: "I am lost.",
          translated: "道に迷いました。",
          pronunciation: "Michi ni mayoimashita.",
        },
        {
          english: "Please help me call my teacher.",
          translated: "先生に電話するのを手伝ってください。",
          pronunciation: "Sensei ni denwa suru no o tetsudatte kudasai.",
        },
        {
          english: "Can you help me?",
          translated: "手伝ってもらえますか？",
          pronunciation: "Tetsudatte moraemasu ka?",
        },
      ],
    },
    {
      name: "Travel",
      phrases: [
        {
          english: "Where is the station?",
          translated: "駅はどこですか？",
          pronunciation: "Eki wa doko desu ka?",
        },
        {
          english: "Which platform?",
          translated: "何番ホームですか？",
          pronunciation: "Nanban hoomu desu ka?",
        },
        {
          english: "I need to go to this address.",
          translated: "この住所に行きたいです。",
          pronunciation: "Kono juusho ni ikitai desu.",
        },
      ],
    },
    {
      name: "Food",
      phrases: [
        {
          english: "Do you have an English menu?",
          translated: "英語のメニューはありますか？",
          pronunciation: "Eigo no menyuu wa arimasu ka?",
        },
        {
          english: "No meat, please.",
          translated: "お肉なしでお願いします。",
          pronunciation: "Oniku nashi de onegaishimasu.",
        },
        {
          english: "Can I please have some fried chicken?",
          translated: "フライドチキンをください。",
          pronunciation: "Furaido chikin o kudasai.",
        },
      ],
    },
    {
      name: "Medical",
      phrases: [
        {
          english: "I feel sick.",
          translated: "気分が悪いです。",
          pronunciation: "Kibun ga warui desu.",
        },
        {
          english: "I need a doctor.",
          translated: "医者が必要です。",
          pronunciation: "Isha ga hitsuyou desu.",
        },
        {
          english: "I have an allergy.",
          translated: "アレルギーがあります。",
          pronunciation: "Arerugii ga arimasu.",
        },
      ],
    },
    {
      name: "Hotel",
      phrases: [
        {
          english: "I have a reservation.",
          translated: "予約しています。",
          pronunciation: "Yoyaku shiteimasu.",
        },
        {
          english: "What time is breakfast?",
          translated: "朝食は何時ですか？",
          pronunciation: "Choushoku wa nanji desu ka?",
        },
      ],
    },
    {
      name: "Money",
      phrases: [
        {
          english: "How much is this?",
          translated: "これはいくらですか？",
          pronunciation: "Kore wa ikura desu ka?",
        },
        {
          english: "Do you accept credit cards?",
          translated: "クレジットカードは使えますか？",
          pronunciation: "Kurejitto kaado wa tsukaemasu ka?",
        },
      ],
    },
    {
      name: "Polite / Thank you",
      phrases: [
        {
          english: "Thank you.",
          translated: "ありがとうございます。",
          pronunciation: "Arigatou gozaimasu.",
        },
        {
          english: "Excuse me / Sorry.",
          translated: "すみません。",
          pronunciation: "Sumimasen.",
        },
        {
          english: "Please.",
          translated: "お願いします。",
          pronunciation: "Onegaishimasu.",
        },
      ],
    },
  ];

  let sortOrder = 0;
  for (const cat of categories) {
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

