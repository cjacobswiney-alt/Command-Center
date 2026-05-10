export const metadata = {
  title: "Privacy Policy — Command Center",
};

export default function PrivacyPolicy() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 text-[#1a1a1a]">
      <h1 className="text-2xl font-semibold mb-2">Privacy Policy</h1>
      <p className="text-sm text-[#535457] mb-8">Last updated: May 2026</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="text-base font-semibold mb-2">Overview</h2>
          <p>
            Command Center is a personal productivity application built and operated by a single user
            (the &quot;Operator&quot;) for their own use. It is not offered to the public and does not have other
            end users. This policy describes how data is handled within the application.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-2">Data collected</h2>
          <p>The application connects to and processes the following data on behalf of the Operator:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Email metadata and content from the Operator&apos;s Microsoft 365 account (subject, sender, preview)</li>
            <li>Calendar events from the Operator&apos;s Microsoft and Google calendars</li>
            <li>Health, recovery, sleep, strain, and workout data from the Operator&apos;s WHOOP account</li>
            <li>Tasks, notes, daily logs, training data, and meal plans the Operator enters manually</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-2">Storage</h2>
          <p>
            All data is stored in a private Supabase database controlled by the Operator. OAuth tokens
            are stored encrypted at rest by Supabase. The application is deployed on Vercel and
            access is gated by a single password known only to the Operator.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-2">Third-party processing</h2>
          <p>
            Email, calendar, and recovery data are sent to Anthropic&apos;s Claude API to generate daily
            briefings. Anthropic processes this data subject to their own terms and privacy policy.
            No data is shared with any other third party.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-2">Data retention and deletion</h2>
          <p>
            Data is retained indefinitely while the application is in use. The Operator may delete
            any data at any time by removing it from the Supabase database. Connected services
            (WHOOP, Google, Microsoft) may be revoked from those services&apos; respective settings;
            doing so will stop further data ingestion.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-2">Contact</h2>
          <p>
            For questions about this policy, contact the Operator at jacob.swiney@buckingham.com.
          </p>
        </div>
      </section>
    </main>
  );
}
