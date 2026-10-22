import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import './Dashboard.css';

// placeholder dashboard — real judging UI lands in Phase 2
// here just to prove the design tokens work beyond the login page
export default function Dashboard() {
  const { user, logout } = useAuth();

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
            <span>judge</span>
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

        <p className="dash-note">
          Events and scorecards start here — head to the docket to
          create one or see what you&apos;ve been assigned.
        </p>

        <div className="dash-actions">
          <Link to="/events" className="dash-cta">open the docket</Link>
          <button className="dash-logout" onClick={logout}>
            Leave the floor
          </button>
        </div>
      </section>
    </main>
  );
}
