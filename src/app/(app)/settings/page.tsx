import { listSecretStatus } from "@/lib/secrets";
import SecretsPanel from "@/components/SecretsPanel";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const secrets = listSecretStatus();
  return (
    <>
      <div className="card">
        <h1>Settings</h1>
        <p className="subtle">
          The keys the app needs for its outside connections. Enter or replace a key here. A saved
          value is never shown back in full — only that it is set and its last four characters.
        </p>
      </div>

      <div className="card">
        <h2>Keys</h2>
        <p className="subtle" style={{ marginTop: 4 }}>
          Each key is used by the build noted beside it. Setting a key early does no harm.
        </p>
        <SecretsPanel secrets={secrets} />
      </div>
    </>
  );
}
