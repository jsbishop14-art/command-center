export const dynamic = "force-dynamic";

export default function SoonPage({ searchParams }: { searchParams: { s?: string } }) {
  const screen = searchParams.s || "This screen";
  return (
    <div className="card">
      <h1>{screen}</h1>
      <p className="subtle" data-testid="coming-soon">
        Coming in a later build.
      </p>
    </div>
  );
}
