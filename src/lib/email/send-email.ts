import { getPlatformSetting } from "@/lib/billing/settings";

export type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult =
  | { ok: true; id?: string; mode: "resend" | "log" }
  | { ok: false; error: string; mode: "disabled" };

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const from =
    process.env.EMAIL_FROM?.trim() ||
    "Itinerary Live <onboarding@itinerarylive.app>";

  if (!resendConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[email] RESEND_API_KEY missing — email not sent:", params.subject, params.to);
      return { ok: false, error: "Email provider not configured.", mode: "disabled" };
    }
    console.info("[email:dev]", { to: params.to, subject: params.subject, text: params.text });
    return { ok: true, mode: "log" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
      html: params.html ?? params.text.replace(/\n/g, "<br>"),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[email] Resend error", res.status, body);
    return { ok: false, error: `Resend failed (${res.status}).`, mode: "disabled" };
  }

  const json = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, id: json.id, mode: "resend" };
}

export async function getSupportEmail(): Promise<string> {
  const configured = await getPlatformSetting("support_email");
  if (typeof configured === "string" && configured.includes("@")) return configured;
  return process.env.SUPPORT_EMAIL?.trim() || "support@itinerarylive.app";
}
