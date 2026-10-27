import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import './Dashboard.css';

// role-aware landing — everyone gets their own way in, not one copy fits all
const BLURB = {
    team: {
        note: 'Your project lives on the docket — paste the repo and demo links, run the AI report card, and see your stack, structure, and readiness rated 1–10.',
        cta: 'open your project'
    },
    judge: {
        note: 'Your assigned events and scorecards start here — head to the docket to review submissions with the AI drafts and report cards beside you.',
        cta: 'open the docket'
    },
    organizer: {
        note: 'Create an event, invite judges, and follow submissions as they land — the docket is your run sheet.',
        cta: 'open the docket'
    }
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const blurb = BLURB[user.role] || BLURB.judge;

  return (
    <main className="dash">
      {/* same lamp + grain atmosphere as login, minus the busy bits */}
      <div className="dash-bg" aria-hidden="true">
        <div className="dash-lamp" />
        <div className="dash-grain" />
      </div>

      <header className="dash-header">
        <span className="dash-eyebrow">the judging floor</span>
        <h1>HackJudge <em>AI</em></h1>
      </header>

      <section className="dash-card">
        <div className="dash-card-row">
          <div className="dash-field">
            <span>name</span>
            <strong>{user.name}</strong>
          </div>
          <div className="dash-field">
            <span>role</span>
            <strong className="dash-role">{user.role}</strong>
          </div>
          <div className="dash-field">
            <span>email</span>
            <strong>{user.email}</strong>
          </div>
        </div>

        <p className="dash-note">{blurb.note}</p>

        <div className="dash-actions">
          <Link to="/events" className="dash-cta">{blurb.cta}</Link>
          <button className="dash-logout" onClick={logout}>
            Leave the floor
          </button>
        </div>
      </section>
    </main>
  );
}
