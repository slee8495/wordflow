import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Wordflow",
};

const LAST_UPDATED = "August 4, 2026";
const CONTACT_EMAIL = "slstudio8495@gmail.com";

export default function TermsPage() {
  return (
    <div className="flex flex-col gap-6 text-sm leading-relaxed text-[var(--ink)]">
      <div>
        <h1 className="text-xl font-semibold">Terms of Service</h1>
        <p className="mt-1 text-[var(--ink-soft)]">Last updated: {LAST_UPDATED}</p>
      </div>

      <p>
        These terms govern your use of Wordflow, a daily Bible-reading app operated by SL Studio
        (&quot;we,&quot; &quot;us&quot;). By using Wordflow, you agree to these terms.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">The service</h2>
        <p>
          Wordflow delivers a daily Bible passage — based on the New Living Translation (NLT) — along
          with AI-generated context, reflection, and audio narration, following a repeating
          curriculum through the whole Bible. The AI-generated content is provided for personal
          devotional use and is not a substitute for pastoral guidance or formal theological study.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">Accounts</h2>
        <p>
          You sign in with your Google account. You&apos;re responsible for keeping that account
          secure. One person should use one account — sharing accounts is fine within a household,
          but the app isn&apos;t designed for large-scale shared access.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">Subscription and billing</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Wordflow costs $3.99/month after a 7-day free trial, billed through Stripe.</li>
          <li>Your card is charged automatically when the trial ends, unless you cancel first.</li>
          <li>You can cancel anytime from Settings → Manage billing. Cancelling stops future billing; you keep access through the end of the period you&apos;ve already paid for.</li>
          <li>We don&apos;t offer prorated refunds for partial billing periods, except where required by law.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">Acceptable use</h2>
        <p>
          Please don&apos;t try to disrupt the service, scrape or bulk-download content, reverse
          engineer the app, or use it in a way that violates applicable law. We may suspend or
          terminate accounts that do.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">Content</h2>
        <p>
          Bible text is used under license from Tyndale House Publishers. AI-generated context,
          reflections, and Korean-language renderings are produced by Wordflow and, while we aim
          for accuracy and care, may occasionally contain errors — please use your own judgment
          alongside them.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">Disclaimer and limitation of liability</h2>
        <p>
          Wordflow is provided &quot;as is,&quot; without warranties of any kind. To the fullest
          extent permitted by law, SL Studio isn&apos;t liable for any indirect, incidental, or
          consequential damages arising from your use of the app.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">Changes</h2>
        <p>
          We may update these terms as the app evolves. Material changes will be reflected by
          updating the date at the top of this page.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">Contact</h2>
        <p>
          Questions about these terms? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--clay-deep)] hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </div>
  );
}
