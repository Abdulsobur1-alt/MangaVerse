import type { Metadata } from 'next';
import { LegalPage, LegalH2, LegalP, LegalList } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service — MangaVerse',
  description: 'The terms that govern your use of MangaVerse.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="August 7, 2026">
      <LegalH2>1. Acceptance</LegalH2>
      <LegalP>
        By creating an account or using MangaVerse you agree to these Terms. If you do not agree,
        please do not use the service.
      </LegalP>

      <LegalH2>2. Your account</LegalH2>
      <LegalList
        items={[
          'You must provide accurate information and keep your credentials secure.',
          'One person, one account — accounts may not be shared or sold.',
          'You are responsible for everything done through your account.',
        ]}
      />

      <LegalH2>3. Acceptable use</LegalH2>
      <LegalP>You agree not to:</LegalP>
      <LegalList
        items={[
          'Upload malware, phishing content, or anything that harms the platform or its users.',
          'Upload content you have no right to share (see the DMCA page for takedowns).',
          'Attempt to access other accounts, bypass paywalls, or abuse the coins system.',
          'Harass, threaten, or dox other users, or post content that is illegal in your jurisdiction.',
        ]}
      />

      <LegalH2>4. Staff & uploaded content</LegalH2>
      <LegalP>
        Staff members (moderators, editors, uploaders) may add, edit and arrange series content —
        including uploaded images and prose. Staff confirm they have the rights to share what they
        upload. MangaVerse reserves the right to remove any content that violates these Terms or the
        DMCA, and to revoke staff access for abuse.
      </LegalP>

      <LegalH2>5. Intellectual property</LegalH2>
      <LegalP>
        The platform itself (code, design, branding) is owned by MangaVerse. Series titles, covers
        and artwork remain the property of their respective rights holders. We respond promptly to
        valid DMCA notices — see the DMCA page.
      </LegalP>

      <LegalH2>6. Coins, unlocks & purchases</LegalH2>
      <LegalP>
        Coins are virtual credits used to unlock coin-locked chapters. Coins have no cash value, are
        non-refundable except where required by law, and can be removed for abuse. Where paid
        purchases are offered, they are subject to the payment provider&apos;s terms as well.
      </LegalP>

      <LegalH2>7. Service availability</LegalH2>
      <LegalP>
        We work to keep MangaVerse available but do not guarantee uninterrupted service. The service
        may be modified, suspended or discontinued at any time, with notice where reasonably
        possible.
      </LegalP>

      <LegalH2>8. Liability</LegalH2>
      <LegalP>
        The service is provided “as is”. To the maximum extent permitted by law, MangaVerse is not
        liable for indirect or consequential damages, or for content uploaded by users.
      </LegalP>

      <LegalH2>9. Termination</LegalH2>
      <LegalP>
        You may delete your account at any time. We may suspend or terminate accounts that violate
        these Terms, including repeat copyright infringement.
      </LegalP>

      <LegalH2>10. Changes & contact</LegalH2>
      <LegalP>
        We may update these Terms; material changes will be announced. Questions: legal@mangaverse.app.
      </LegalP>
    </LegalPage>
  );
}
