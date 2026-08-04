import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Wordflow",
};

const LAST_UPDATED = "August 4, 2026";
const CONTACT_EMAIL = "slstudio8495@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="flex flex-col gap-6 text-sm leading-relaxed text-[var(--ink)]">
      <div>
        <h1 className="text-xl font-semibold">Privacy Policy</h1>
        <p className="mt-1 text-[var(--ink-soft)]">Last updated: {LAST_UPDATED}</p>
      </div>

      <p>
        Wordflow (&quot;we,&quot; &quot;us&quot;) is operated by SL Studio. This policy explains what
        information we collect through the Wordflow app, how we use it, and who we share it with.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">Information we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account information:</strong> your name and email address, provided by Google
            when you sign in with your Google account.
          </li>
          <li>
            <strong>Reading activity:</strong> your progress through the reading curriculum, the
            passages you&apos;ve read, playback position (so you can resume where you left off),
            and reading-streak/history data.
          </li>
          <li>
            <strong>Preferences:</strong> your chosen app language, timezone, font size, and
            notification settings.
          </li>
          <li>
            <strong>Push notification data:</strong> if you enable the morning reminder, your
            browser&apos;s push subscription endpoint, used only to deliver that notification.
          </li>
          <li>
            <strong>Billing information:</strong> if you subscribe, Stripe (our payment processor)
            handles and stores your payment details directly. We never see or store your full card
            number. We keep a reference to your Stripe customer/subscription ID and your
            subscription status so the app knows what you&apos;re entitled to.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">How we use this information</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>To provide the daily reading experience and remember your progress.</li>
          <li>To generate that day&apos;s content and audio (see &quot;Third-party services&quot; below).</li>
          <li>To send the morning reminder notification, if you&apos;ve turned it on.</li>
          <li>To process your subscription payment and manage billing.</li>
          <li>To diagnose bugs and keep the app working reliably.</li>
        </ul>
        <p>We do not sell your personal information, and we do not use it for advertising.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">Third-party services</h2>
        <p>Wordflow relies on the following services to operate, each of which processes some data on our behalf:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Google</strong> — sign-in / authentication.</li>
          <li><strong>Stripe</strong> — subscription billing and payment processing.</li>
          <li><strong>Anthropic (Claude)</strong> — generates the daily context, reflection, and Korean passage text.</li>
          <li><strong>A text-to-speech provider</strong>, accessed via Vercel AI Gateway — generates the audio narration.</li>
          <li><strong>Tyndale House Publishers (api.nlt.to)</strong> — supplies the underlying NLT Bible text.</li>
          <li><strong>Neon</strong> — hosts our database.</li>
          <li><strong>Vercel</strong> — hosts the app and stores generated audio files.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">Data retention and deletion</h2>
        <p>
          We keep your account and reading data for as long as your account is active. If you&apos;d
          like your account and associated data deleted, email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--clay-deep)] hover:underline">
            {CONTACT_EMAIL}
          </a>{" "}
          and we&apos;ll take care of it.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">Children&apos;s privacy</h2>
        <p>Wordflow is not directed at children under 13, and we do not knowingly collect information from them.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">Changes to this policy</h2>
        <p>
          If we make material changes to this policy, we&apos;ll update the date at the top of this
          page. Continued use of Wordflow after a change means you accept the updated policy.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-[var(--ink)]">Contact</h2>
        <p>
          Questions about this policy or your data? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[var(--clay-deep)] hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </div>
  );
}
