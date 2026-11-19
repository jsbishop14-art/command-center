"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitAnswerAction } from "@/app/(app)/builds/actions";
import type { NeedsYouItem } from "@/lib/builds/view";
import CopyCommand from "./CopyCommand";

// Answer a build's questions in place, one at a time, with the options and the recommendation
// (handoff §7.1). Josh picks an option or types his own answer; on submit the app writes it verbatim
// to the status file with chain.md in the same commit (the server action). When none remain the panel
// shows "Answers saved. Restart the runner" with the runner command and a Copy button (process.md
// §11: the app does not start the runner). Both logins may answer (handoff §1.1).
export default function QuestionPanel({ item }: { item: Extract<NeedsYouItem, { kind: "questions" }> }) {
  const [idx, setIdx] = useState(0);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ runnerCommand: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const questions = item.questions;
  const q = questions[idx];
  const answeredSoFar = item.totalQuestions - questions.length;

  if (done) {
    return (
      <div className="builds-answered" data-testid={`needsyou-${item.repo}`}>
        <div className="builds-needs-head">
          <strong>{item.project} · {item.buildName}</strong>
          <span className="mono subtle">{item.totalQuestions} of {item.totalQuestions} answered</span>
        </div>
        <div className="builds-saved" data-testid="answers-saved">✓ Answers saved. Restart the runner</div>
        {done.runnerCommand ? (
          <>
            <div className="subtle">Paste this at the plain terminal prompt in the build workspace:</div>
            <CopyCommand command={done.runnerCommand} />
          </>
        ) : null}
      </div>
    );
  }

  if (!q) return null;

  const value = typed[q.id]?.trim() ? typed[q.id].trim() : (choice[q.id] ?? "");

  function submit() {
    if (!q) return;
    if (!value) {
      setError("Pick an option or type an answer.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await submitAnswerAction({
        repo: item.repo,
        branch: item.branch,
        buildName: item.buildName,
        questionId: q.id,
        questionNumber: q.number,
        answer: value,
      });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      if (r.remaining === 0) {
        setDone({ runnerCommand: r.runnerCommand });
      } else if (idx + 1 < questions.length) {
        setIdx(idx + 1);
      } else {
        // The server still reports unanswered questions but we have cycled the list we were given.
        router.refresh();
      }
    });
  }

  const isLast = idx + 1 >= questions.length;
  return (
    <fieldset className="builds-question" data-testid={`needsyou-${item.repo}`}>
      <legend className="sr-only">{item.project} question</legend>
      <div className="builds-needs-head">
        <strong>{item.project} · {item.buildName}</strong>
        <span className="mono subtle" data-testid="q-progress">
          Q{answeredSoFar + idx + 1} of {item.totalQuestions}
        </span>
      </div>
      <div className="builds-q-text" data-testid="q-text">{q.text}</div>
      <div className="builds-q-options">
        {q.options.map((o) => (
          <label key={o.key} className="builds-q-option">
            <input
              type="radio"
              name={`q-${item.repo}-${q.id}`}
              data-testid={`q-opt-${o.key}`}
              checked={choice[q.id] === o.key && !typed[q.id]?.trim()}
              onChange={() => {
                setChoice((c) => ({ ...c, [q.id]: o.key }));
                setTyped((t) => ({ ...t, [q.id]: "" }));
              }}
            />
            <span><strong>{o.key})</strong> {o.text}</span>
          </label>
        ))}
      </div>
      {q.recommendation ? (
        <div className="builds-rec"><strong>My recommendation:</strong> {q.recommendation}</div>
      ) : null}
      <label className="builds-q-own">
        Or your own answer
        <textarea
          rows={2}
          data-testid="q-own"
          placeholder="Type your answer"
          value={typed[q.id] ?? ""}
          onChange={(e) => setTyped((t) => ({ ...t, [q.id]: e.target.value }))}
        />
      </label>
      {error ? <span className="error" role="alert">{error}</span> : null}
      <div className="builds-q-actions">
        <button
          className="btn ghost"
          type="button"
          data-testid="q-prev"
          disabled={idx === 0 || pending}
          onClick={() => setIdx(Math.max(0, idx - 1))}
        >
          Previous
        </button>
        <button
          className="btn accent"
          type="button"
          data-testid="q-submit"
          disabled={pending}
          onClick={submit}
        >
          {pending ? "Saving…" : isLast ? "Save answer" : "Save and next"}
        </button>
      </div>
    </fieldset>
  );
}
