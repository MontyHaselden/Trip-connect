import Link from "next/link";

import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DEFAULT_SUPPORT_EMAIL, LEGAL_OPERATOR, PRODUCT_NAME } from "@/lib/brand";

export default function TermsPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 py-16 prose prose-zinc">
        <h1>Terms of use</h1>
        <p className="text-sm text-zinc-500">Last updated: June 2026</p>

        <p>
          These terms govern your use of {PRODUCT_NAME}, operated by {LEGAL_OPERATOR} (&quot;we&quot;,
          &quot;us&quot;).
        </p>

        <h2>Service</h2>
        <p>
          {PRODUCT_NAME} helps schools plan and publish school trip itineraries for staff, students,
          parents, and approved viewers. The service is provided on a subscription or trial basis as
          described on our pricing page.
        </p>

        <h2>School accounts</h2>
        <p>
          School staff who create an account are responsible for the accuracy of trip information,
          participant data they enter, and who receives invite or viewer links. You must have
          authority to process student and minor data for your school trip.
        </p>

        <h2>No live GPS tracking</h2>
        <p>
          {PRODUCT_NAME} does not provide live GPS tracking or continuous location monitoring of
          students.
        </p>

        <h2>Acceptable use</h2>
        <p>
          You must not misuse the service, attempt unauthorised access, or upload unlawful content.
          We may suspend accounts that breach these terms or for non-payment after notice.
        </p>

        <h2>Data and availability</h2>
        <p>
          We aim for reliable service but do not guarantee uninterrupted access. Trip data remains
          yours; we provide the platform to store and publish it subject to your plan and billing
          status.
        </p>

        <h2>Liability</h2>
        <p>
          To the extent permitted by New Zealand law, our liability is limited to fees paid in the
          twelve months before a claim. {PRODUCT_NAME} is a planning and communication tool — trip
          leaders remain responsible for duty of care on the ground.
        </p>

        <h2>Contact</h2>
        <p>
          Questions:{" "}
          <a href={`mailto:${DEFAULT_SUPPORT_EMAIL}`}>{DEFAULT_SUPPORT_EMAIL}</a>
        </p>

        <p>
          <Link href="/privacy">Privacy policy</Link> · <Link href="/contact">Contact</Link>
        </p>
      </article>
    </MarketingShell>
  );
}
