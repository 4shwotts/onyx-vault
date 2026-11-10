import { Link } from 'react-router-dom';
import LegalPage from '../components/LegalPage';

export default function Disclaimer() {
  return (
    <LegalPage title="Disclaimer" updated="10 November 2026">
      <div className="summary">
        <p style={{ marginBottom: 0 }}><strong>Onyx Vault is a portfolio project, not a real financial service.</strong> It isn’t connected
          to any bank, isn’t regulated by the Financial Conduct Authority (FCA), doesn’t give financial advice, and shouldn’t be given
          real financial details.</p>
      </div>

      <h2>A portfolio project</h2>
      <p>Onyx Vault was built to demonstrate software engineering and testing skills. It is <strong>not a real financial service</strong>,
        and it isn’t a product offered to the public.</p>

      <h2>No bank, no money, no regulation</h2>
      <ul>
        <li>It <strong>isn’t connected to any bank</strong> or card provider, and doesn’t use open banking. Everything in it is typed in
          by you or made up.</li>
        <li>It <strong>doesn’t move, hold or look after money</strong>. The “accounts” and “balances” are just labels and running totals
          of what you type in.</li>
        <li>It <strong>isn’t authorised or regulated by the Financial Conduct Authority (FCA)</strong>, and nothing in it is covered by
          the Financial Services Compensation Scheme or the Financial Ombudsman Service.</li>
      </ul>

      <h2>Not financial advice</h2>
      <p>Nothing in Onyx Vault is <strong>financial advice</strong>. Its charts, totals, projections and spending summaries only describe
        the figures you entered; they don’t recommend anything. Don’t base financial decisions on them.</p>

      <h2>Don’t enter real financial details</h2>
      <p>Please <strong>don’t enter real financial details</strong>, such as real transactions, account or card numbers, or bank
        statements. Use made-up data, or <Link to="/demo">try the demo</Link>, which is already full of made-up data.</p>

      <h2>Provided as it is</h2>
      <p>Onyx Vault is <strong>provided “as is”, with no guarantees</strong> of any kind: that it will be available, accurate, secure or
        free of errors. To the fullest extent the law allows, the developer isn’t liable for any loss arising from using it. Nothing in
        this disclaimer limits any liability that cannot be limited by law.</p>

      <h2>Your data may be reset or deleted</h2>
      <p>Data may be <strong>reset or deleted</strong> at any time, without warning. Demo accounts are always deleted after 24 hours, or
        when you end the demo. Don’t rely on Onyx Vault to keep anything.</p>

      <p>How personal data is handled is explained in the <Link to="/privacy">privacy notice</Link>.</p>
    </LegalPage>
  );
}
