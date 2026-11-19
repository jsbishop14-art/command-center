export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <div className="card">
        <h1>Home</h1>
        <p className="subtle">
          The foundation is in place: your sign-in, the three boards and the glass layout. The Home
          panels — money, today, inbox, awaiting reply, kanban, projects and the schedule — fill in
          as each later build lands.
        </p>
      </div>
      <div className="card">
        <h2>What works now</h2>
        <ul className="subtle" style={{ lineHeight: 1.8 }}>
          <li>Josh and Christine sign in with their own logins.</li>
          <li>The board toggle (Josh, Christine, Bishops) is remembered for you.</li>
          <li>Settings holds every key the app will need, entered and replaced safely.</li>
          <li>The Mac mini keeps itself up to date after each build lands.</li>
        </ul>
      </div>
    </>
  );
}
