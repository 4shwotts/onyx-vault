import { Link } from 'react-router-dom';
import LegalPage from '../components/LegalPage';

export const CONTACT_EMAIL = 'ulasatik04@gmail.com';

// Written to match what the code actually does (see the backend for the
// figures quoted here: 24-hour sessions and demos, 24-hour verification
// links, 1-hour reset links, rate-limit windows of up to an hour). If the
// code changes, this page must change with it.
export default function Privacy() {
  return (
    <LegalPage title="Privacy notice" updated="10 November 2026">
      <div className="summary">
        <p><strong>In short:</strong> Onyx Vault is a portfolio project, not a real financial service. It stores your email
          address, a scrambled form of your password and whatever you type in, only to run the app. There’s one cookie, to keep you
          signed in. Nothing is sold, shared for marketing or used for advertising. You can delete your account, and everything in it,
          at any time.</p>
        <p style={{ marginBottom: 0 }}><strong>Please don’t enter real financial details.</strong> Use made-up data, or try the demo, which
          needs no personal details at all.</p>
      </div>

      <h2>Who is responsible for your data</h2>
      <p>Onyx Vault is a personal portfolio project run by its developer, who is the “data controller” for the personal data described
        here under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. You can contact the developer
        at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>

      <h2>What is stored, and why</h2>
      <ul>
        <li><strong>Your account:</strong> your email address, your password (stored only as a one-way bcrypt hash, never as the password
          itself), whether your email address has been verified, and when the account was created. This is needed to give you an account
          and let you sign in (the lawful basis is <em>contract</em>: providing the service you asked for).</li>
        <li><strong>What you enter:</strong> the accounts you create (name, type and balance), transactions (amount, description, date
          and category), categories and recurring payments. These are stored only so the app can show them back to you
          (<em>contract</em>).</li>
        <li><strong>Security records:</strong> the one-time links emailed to verify your address (valid for 24 hours) or reset your
          password (valid for 1 hour), and a record of each signed-in session (valid for 24 hours). Only a scrambled hash of each link and
          session is stored, never the link or session itself. These keep your account secure (<em>contract</em> and our
          <em> legitimate interest</em> in protecting accounts).</li>
        <li><strong>“Unusual” labels:</strong> a transaction is automatically labelled “unusual” if it is more than three times your
          own average spending in that category. The label is only shown to you; no decisions are made about you.</li>
      </ul>
      <p>The demo needs no personal details. A demo account has no email address or password (it gets a random address on the reserved
        <code> .invalid</code> domain, which can never receive email) and is filled with made-up data.</p>

      <h2>IP addresses</h2>
      <p>To stop people guessing passwords or flooding the sign-up, demo and email features, the app counts recent requests from each
        IP address and briefly blocks an address that makes too many. These counts are kept only in the server’s memory, for up to one
        hour, and are never saved to the database. Our hosting providers (below) also record IP addresses in their own request logs for
        security and operations, under their own privacy policies.</p>

      <h2>Cookies</h2>
      <p>Onyx Vault uses <strong>one cookie</strong>, called <code>token</code>, which keeps you signed in. It can’t be read by scripts
        on the page, is sent only to this site, lasts 24 hours and is removed when you log out. It is strictly necessary for signing
        in, so no consent banner is needed. There are no analytics, advertising or tracking cookies, nothing else is stored in your
        browser, and the fonts are served from this site rather than a third party.</p>

      <h2>Who else handles your data</h2>
      <p>The app is run on these services, which process data on our behalf:</p>
      <ul>
        <li><strong>Vercel</strong> hosts the website and passes your requests to the API (it sees requests, including your IP
          address).</li>
        <li><strong>Render</strong> runs the API that handles your requests.</li>
        <li><strong>Neon</strong> hosts the database, in its London (UK) region.</li>
        <li><strong>Brevo</strong> sends the verification and password-reset emails (it receives your email address and the email’s
          content).</li>
      </ul>
      <p>Vercel and Render are based in the United States and may process data outside the UK; Brevo is based in the EU. Where personal
        data leaves the UK, the transfer relies on UK adequacy regulations or the providers’ data protection terms, such as the UK
        International Data Transfer Addendum. Your data is never sold or shared for marketing.</p>

      <h2>How long it is kept</h2>
      <ul>
        <li><strong>Your account and everything in it:</strong> until you delete the account.</li>
        <li><strong>Demo accounts:</strong> 24 hours, or until you choose “End demo”, whichever comes first.</li>
        <li><strong>Email links:</strong> verification links for 24 hours and reset links for 1 hour, or until used.</li>
        <li><strong>Session records:</strong> 24 hours, or until you log out; expired ones are removed every hour.</li>
        <li><strong>Rate-limit counts:</strong> up to one hour, in memory only.</li>
        <li><strong>Providers’ logs and backups:</strong> for the periods set by each provider. Deleted data can remain in a
          provider’s short-term backups until they are overwritten.</li>
      </ul>

      <h2>Deleting your account</h2>
      <p>Sign in, open <strong>Settings</strong> and use <strong>Delete your account</strong>. You’ll be asked for your password, and
        your account and everything in it (accounts, transactions, categories, recurring payments, links and sessions) is deleted
        straight away. If you can’t sign in, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the address on the
        account.</p>

      <h2>Your rights</h2>
      <p>Under UK data protection law you have the right to:</p>
      <ul>
        <li>ask for a copy of your personal data;</li>
        <li>have it corrected if it is wrong;</li>
        <li>have it deleted;</li>
        <li>restrict or object to how it is used;</li>
        <li>receive the data you provided in a portable format.</li>
      </ul>
      <p>To use any of these rights, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. You’ll get a reply within one month.
        If you’re unhappy with how your data is handled, you can complain to the Information Commissioner’s Office (ICO) at{' '}
        <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk/make-a-complaint</a> or on 0303 123 1113.</p>

      <h2>Children</h2>
      <p>Onyx Vault is not intended for children.</p>

      <h2>Changes</h2>
      <p>If this notice changes, the date at the top will change too. See also the <Link to="/disclaimer">disclaimer</Link>.</p>
    </LegalPage>
  );
}
