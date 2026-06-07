import { FAQS } from "./marketing-content";

export function FaqSection() {
  return (
    <section className="border-y border-zinc-200 bg-white py-16">
      <div className="mx-auto max-w-3xl px-5">
        <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
        <dl className="mt-8 space-y-6">
          {FAQS.map((faq) => (
            <div key={faq.q}>
              <dt className="font-semibold text-zinc-900">{faq.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-zinc-600">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
