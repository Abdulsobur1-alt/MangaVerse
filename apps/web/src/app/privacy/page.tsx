import type { Metadata } from 'next';
import { LegalPage, LegalH2, LegalP, LegalList } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy — MangaVerse',
  description: 'How MangaVerse collects, uses and protects your data.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="August 7, 2026">
      <LegalH2>1. What we collect</LegalH2>
      <LegalP>
        We collect the minimum needed to run the service: your account details (email, display name),
        your reading history and library, bookmarks, saved titles, coins balance and transactions, and
        community activity (reviews, comments, lists). Staff accounts additionally have an assigned
        role and a log of content actions taken.
      </LegalP>

      <LegalH2>2. How we use it</LegalH2>
      <LegalList
        items={[
          'To show you your library, continue-reading rail, recommendations and notifications.',
          'To run features you opt into — reading goals, community, coins, predictions.',
          'To keep the platform safe (abuse prevention, moderation, fraud detection).',
          'To improve the product with aggregated, non-identifying analytics (only with your consent via the cookie banner).',
        ]}
      />

      <LegalH2>3. Storage & hosting</LegalH2>
      <LegalP>
        Your data is stored on our hosting providers (PostgreSQL database, Supabase, Redis cache, and
        file storage for uploaded covers and pages). We use standard industry safeguards including TLS
        encryption in transit and encrypted storage at rest.
      </LegalP>

      <LegalH2>4. Cookies</LegalH2>
      <LegalP>
        Essential cookies keep you signed in and remember preferences such as theme and content
        filters — they are always active. Optional analytics cookies are only set after you accept
        them in the banner. You can change your choice anytime by clearing site data in your browser.
      </LegalP>

      <LegalH2>5. Sharing</LegalH2>
      <LegalP>
        We never sell your personal data. We share it only with the service providers that run the
        platform (hosting, email, analytics when consented) and where required by law. Public content
        you post — reviews, comments, lists — is visible to other users by design.
      </LegalP>

      <LegalH2>6. Your rights</LegalH2>
      <LegalList
        items={[
          'Access and export: request a copy of your data by contacting us.',
          'Correction: update your profile and preferences in Settings.',
          'Deletion: delete your account from Settings — we erase your personal data within 30 days (content you posted publicly may remain anonymized).',
          'Withdraw consent: opt out of analytics as described above.',
        ]}
      />

      <LegalH2>7. Children</LegalH2>
      <LegalP>
        The service is not directed at children under 13 (or the applicable age of consent in your
        country). If you believe a child has provided us data, contact us and we will delete it.
      </LegalP>

      <LegalH2>8. Changes</LegalH2>
      <LegalP>
        We may update this policy as the service evolves. Material changes will be announced on the
        platform. Continued use after changes means you accept the updated policy.
      </LegalP>
    </LegalPage>
  );
}
