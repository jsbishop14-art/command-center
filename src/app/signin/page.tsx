import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import SignInForm from "./SignInForm";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  // Already signed in? Go to Home.
  if (currentUser()) redirect("/home");
  return (
    <div className="signin-wrap">
      <div className="signin-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--accent)" }} />
          <div style={{ fontWeight: 700, fontSize: 18 }}>Command Center</div>
        </div>
        <div className="subtle">Sign in to continue.</div>
        <SignInForm />
      </div>
    </div>
  );
}
