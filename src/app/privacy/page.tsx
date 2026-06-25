import Link from "next/link";

import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DEFAULT_SUPPORT_EMAIL, LEGAL_OPERATOR, PRODUCT_NAME } from "@/lib/brand";

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 py-16 prose prose-zinc">
        <h1>Privacy policy</h1>
        <p className="text-sm text-zinc-500">Last updated: June 2026</p>

        <p>
          {LEGAL_OPERATOR} (&quot;we&quot;) operates {PRODUCT_NAME}. This policy explains how we
          handle personal information for school trip planning.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>School staff account details (name, email, school, role)</li>
          <li>Trip content you enter (itinerary, accommodation, transport, activities)</li>
          <li>Student/participant names and contact details you choose to store for the trip</li>
          <li>Trip photos uploaded by participants or staff, subject to moderation settings</li>
          <li>Billing and support correspondence</li>
        </ul>

        <h2>Student and minor data</h2>
        <p>
          Schools are the data controller for student information they upload. We process it on the
          school&apos;s instructions to run the trip itinerary service. Only share the minimum
          information needed for the trip.
        </p>

        <h2>No live GPS tracking</h2>
        <p>
          We do not collect or display live GPS locations of students. Location fields in the
          product refer to trip places (hotels, venues, cities), not real-time tracking.
        </p>

        <h2>Photos and files</h2>
        <p>
          Trip photos are stored to display in day galleries for authorised participants and
          viewers. Hosts can remove photos. Do not upload images you do not have rights to share.
        </p>

        <h2>How we use data</h2>
        <p>
          To provide the service, secure accounts, send transactional emails (welcome, billing,
          support), and improve reliability. We do not sell personal data.
        </p>

        <h2>Retention and deletion</h2>
        <p>
          Data is kept while your account is active. You may request export or deletion of account
          data by emailing{" "}
          <a href={`mailto:${DEFAULT_SUPPORT_EMAIL}`}>{DEFAULT_SUPPORT_EMAIL}</a>. Some records may
          be retained where required by law or for billing disputes.
        </p>

        <h2>Security</h2>
        <p>
          We use industry-standard hosting and access controls. Staff access to production data is
          limited to operational needs.
        </p>

        <h2>Contact</h2>
        <p>
          Privacy requests:{" "}
          <a href={`mailto:${DEFAULT_SUPPORT_EMAIL}`}>{DEFAULT_SUPPORT_EMAIL}</a>
        </p>

        <p>
          <Link href="/terms">Terms of use</Link> · <Link href="/contact">Contact</Link>
        </p>
      </article>
    </MarketingShell>
  );
}
