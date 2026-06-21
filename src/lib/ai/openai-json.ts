import {
  openAiFixtureKey,
  readOpenAiFixture,
  writeOpenAiFixture,
} from "@/lib/ai/openai-fixtures";

export type OpenAiChatTurn = {
  role: "user" | "assistant";
  content: string;
};

async function callOpenAiApi(params: {
  system: string;
  user?: string;
  messages?: OpenAiChatTurn[];
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const apiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: params.system },
  ];
  if (params.messages?.length) {
    apiMessages.push(...params.messages);
  } else if (params.user) {
    apiMessages.push({ role: "user", content: params.user });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: params.temperature ?? 0.2,
      response_format: { type: "json_object" },
      messages: apiMessages,
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

export async function completeOpenAiJson(params: {
  system: string;
  user?: string;
  messages?: OpenAiChatTurn[];
  temperature?: number;
}): Promise<string> {
  const fixtureDir = process.env.OPENAI_FIXTURE_DIR?.trim();
  const fixtureUser = params.messages?.length
    ? JSON.stringify(params.messages)
    : params.user ?? "";
  if (fixtureDir) {
    const key = openAiFixtureKey(params.system, fixtureUser);
    const cached = readOpenAiFixture(fixtureDir, key);
    if (cached) return cached;

    if (process.env.OPENAI_FIXTURE_RECORD === "1") {
      const content = await callOpenAiApi(params);
      writeOpenAiFixture(fixtureDir, key, content);
      return content;
    }

    throw new Error(
      `OpenAI fixture missing (${key}). Record once with OPENAI_FIXTURE_DIR=${fixtureDir} OPENAI_FIXTURE_RECORD=1, then replay for free.`,
    );
  }

  return callOpenAiApi(params);
}

export function parseOpenAiJsonContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Could not parse AI response as JSON.");
  }
}
