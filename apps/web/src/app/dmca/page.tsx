import type { Metadata } from 'next';
import { LegalPage, LegalH2, LegalP, LegalList } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'DMCA — MangaVerse',
  description: 'How to submit a copyright takedown request for MangaVerse.',
};

export default function DmcaPage() {
  return (
    <LegalPage title="DMCA Takedown Policy" updated="August 7, 2026">
      <LegalH2>Reporting copyright infringement</LegalH2>
      <LegalP>
        MangaVerse respects the intellectual property of others and responds to valid notices of
        claimed infringement in accordance with the Digital Millennium Copyright Act (DMCA) and
        equivalent laws worldwide. If you believe content on the platform infringes your copyright,
        send a notice to our designated agent:
      </LegalP>
      <LegalList
        items={[
          <>Email: <span className="text-mv-accent">dmca@mangaverse.app</span></>,
          'Subject line: “DMCA Takedown”',
        ]}
      />

      <LegalH2>Your notice must include</LegalH2>
      <LegalList
        items={[
          'Identification of the copyrighted work you claim is infringed (or a list of works).',
          'The exact URL(s) on MangaVerse where the infringing material appears.',
          'Your contact details: full legal name, mailing address, phone and email.',
          'A statement, under penalty of perjury, that you are authorized to act for the rights holder.',
          'A statement that the information in your notice is accurate and that you have a good-faith belief the use is not authorized.',
          'Your physical or electronic signature.',
        ]}
      />

      <LegalH2>What happens next</LegalH2>
      <LegalP>
        We review each notice promptly. If it is complete and valid, we remove or disable access to
        the identified material and notify the uploader. Repeat infringers have their accounts
        terminated. We also forward notices to the uploader, who may file a counter-notice if they
        believe the removal was a mistake.
      </LegalP>

      <LegalH2>Counter-notice</LegalH2>
      <LegalP>
        If your content was removed and you believe it was a mistake or misidentification, you may
        send a counter-notice to the same address containing your contact details, identification of
        the removed material and its former URL, a statement under penalty of perjury that you have a
        good-faith belief the material was removed by mistake, your consent to jurisdiction, and your
        signature. We will restore the material unless the original complainant files a court action
        within the statutory period.
      </LegalP>

      <LegalH2>Abuse</LegalH2>
      <LegalP>
        Knowingly submitting a false or misleading notice is an offense in many jurisdictions and can
        result in liability. Please make sure you actually own or represent the rights before filing.
      </LegalP>
    </LegalPage>
  );
}
