import { z } from "zod";

export type PhraseTranslateContext = {
  destinationLanguage: string;
  destinationCountry: string | null;
  tripName?: string;
};

const SingleResultSchema = z.object({
  translatedText: z.string().min(1),
  pronunciation: z.string().min(1),
});

const BatchResultSchema = z.object({
  results: z.array(
    z.object({
      id: z.string().uuid(),
      translatedText: z.string().min(1),
      pronunciation: z.string().min(1),
    }),
  ),
});

export type PhraseTranslateResult = z.infer<typeof SingleResultSchema>;

export type PhraseBatchInput = { id: string; englishText: string };

function requireApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  return apiKey;
}

function languageLabel(code: string, country: string | null) {
  const c = country ? ` (${country})` : "";
  return `${code}${c}`;
}

async function callOpenAI(system: string, user: string) {
  const apiKey = requireApiKey();
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`OpenAI request failed (${res.status}): ${errBody.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return content;
}

export function assertDestinationLanguage(lang: string | null | undefined) {
  if (!lang?.trim()) {
    throw new Error(
      "Set destination language in Trip settings before using AI phrase translation.",
    );
  }
  return lang.trim();
}

export async function translatePhrase(params: {
  englishText: string;
  context: PhraseTranslateContext;
}): Promise<PhraseTranslateResult> {
  const english = params.englishText.trim();
  if (!english) throw new Error("English text is required.");
  if (english.length > 500) throw new Error("English text is too long (max 500 characters).");

  const lang = assertDestinationLanguage(params.context.destinationLanguage);
  const system = `You translate short emergency/travel phrases for school students visiting ${languageLabel(lang, params.context.destinationCountry)}.

Return ONLY JSON: {"translatedText":"...","pronunciation":"..."}

Rules:
- translatedText: natural phrase in the destination language for showing to locals (polite, clear).
- pronunciation: romanization an English-speaking student can read aloud (e.g. Hepburn for Japanese).
- Keep phrases concise. No markdown.`;

  const content = await callOpenAI(
    system,
    JSON.stringify({ englishText: english }),
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Could not parse AI response as JSON.");
  }

  const validated = SingleResultSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error("AI response did not match the expected phrase format.");
  }
  return validated.data;
}

const MAX_BATCH_SIZE = 40;

export async function translatePhrasesBatch(params: {
  phrases: PhraseBatchInput[];
  context: PhraseTranslateContext;
}) {
  if (!params.phrases.length) {
    return { results: [] as Array<PhraseTranslateResult & { id: string }> };
  }
  if (params.phrases.length > MAX_BATCH_SIZE) {
    throw new Error(`Too many phrases (max ${MAX_BATCH_SIZE} per batch).`);
  }

  const lang = assertDestinationLanguage(params.context.destinationLanguage);
  const system = `You translate emergency/travel phrases for school students visiting ${languageLabel(lang, params.context.destinationCountry)}.

Return ONLY JSON:
{"results":[{"id":"uuid","translatedText":"...","pronunciation":"..."}]}

Rules:
- One result per input id, same ids as provided.
- translatedText in destination language; pronunciation as romanization for English speakers.
- Polite, short, show-to-locals style. No markdown.`;

  const content = await callOpenAI(
    system,
    JSON.stringify({ phrases: params.phrases }),
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Could not parse AI response as JSON.");
  }

  const validated = BatchResultSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error("AI batch response did not match the expected format.");
  }

  const inputIds = new Set(params.phrases.map((p) => p.id));
  for (const r of validated.data.results) {
    if (!inputIds.has(r.id)) {
      throw new Error("AI response included an unknown phrase id.");
    }
  }

  return validated.data;
}
