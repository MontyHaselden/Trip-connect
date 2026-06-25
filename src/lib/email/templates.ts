const PRODUCT = "Itinerary Live";
const OPERATOR = "PayShare Limited trading as Itinerary Live";

import { appUrl } from "@/lib/app-url";

export type WelcomeEmailParams = {
  fullName: string;
  trialEndsAt: string;
  supportEmail: string;
};

export function welcomeEmail(params: WelcomeEmailParams) {
  const subject = `Welcome to ${PRODUCT}`;
  const text = [
    `Hi ${params.fullName},`,
    "",
    `Welcome to ${PRODUCT}. Your school account includes a 7-day free trial so you can build trips and preview the student view.`,
    "",
    `Trial ends: ${params.trialEndsAt}`,
    "",
    `Open your dashboard: ${appUrl("/dashboard")}`,
    "",
    `Founding schools can lock in $240 NZD + GST for the first year (normally $400 NZD + GST per year). Reply to this email or contact ${params.supportEmail} to arrange billing.`,
    "",
    OPERATOR,
  ].join("\n");

  return { subject, text, html: text.replace(/\n/g, "<br>") };
}

export type TrialEndingEmailParams = {
  fullName: string;
  trialEndsAt: string;
  supportEmail: string;
};

export function trialEndingEmail(params: TrialEndingEmailParams) {
  const subject = `Your ${PRODUCT} trial ends soon`;
  const text = [
    `Hi ${params.fullName},`,
    "",
    `Your free trial ends on ${params.trialEndsAt}. After that, live student links pause until your school account is activated.`,
    "",
    `Your trip data stays safe. Contact ${params.supportEmail} for an invoice or founding-school pricing.`,
    "",
    OPERATOR,
  ].join("\n");

  return { subject, text, html: text.replace(/\n/g, "<br>") };
}

export type InvoiceSentEmailParams = {
  fullName: string;
  invoiceNumber: string;
  totalDisplay: string;
  dueDate: string;
  supportEmail: string;
};

export function invoiceSentEmail(params: InvoiceSentEmailParams) {
  const subject = `Invoice ${params.invoiceNumber} from ${PRODUCT}`;
  const text = [
    `Hi ${params.fullName},`,
    "",
    `Please find your ${PRODUCT} invoice ${params.invoiceNumber} for ${params.totalDisplay}, due ${params.dueDate}.`,
    "",
    `Pay by bank transfer using the reference on the invoice, then reply to ${params.supportEmail} so we can activate your account.`,
    "",
    OPERATOR,
  ].join("\n");

  return { subject, text, html: text.replace(/\n/g, "<br>") };
}

export type AccountActivatedEmailParams = {
  fullName: string;
  supportEmail: string;
};

export function accountActivatedEmail(params: AccountActivatedEmailParams) {
  const subject = `Your ${PRODUCT} account is active`;
  const text = [
    `Hi ${params.fullName},`,
    "",
    `Your school account is now active. You can publish live updates and share student invite links.`,
    "",
    `Questions? ${params.supportEmail}`,
    "",
    OPERATOR,
  ].join("\n");

  return { subject, text, html: text.replace(/\n/g, "<br>") };
}

export type InviteUserEmailParams = {
  inviteeName: string;
  inviterName: string;
  tripName: string;
  loginUrl: string;
};

export function inviteUserEmail(params: InviteUserEmailParams) {
  const subject = `You're invited to help on ${params.tripName}`;
  const text = [
    `Hi ${params.inviteeName},`,
    "",
    `${params.inviterName} invited you to help manage "${params.tripName}" on ${PRODUCT}.`,
    "",
    `Log in: ${params.loginUrl}`,
    "",
    OPERATOR,
  ].join("\n");

  return { subject, text, html: text.replace(/\n/g, "<br>") };
}
