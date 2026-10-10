"use client";

import { useActionState } from "react";
import { reviewLogin } from "./actions";

export function ReviewForm() {
  const [state, action, pending] = useActionState(reviewLogin, { error: null });
  return (
    <form action={action} className="tp-stack" data-testid="review-form">
      <div className="tp-field">
        <label htmlFor="tp-review-user">Username</label>
        <input
          id="tp-review-user"
          name="username"
          className="tp-input"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={64}
          defaultValue={state.username ?? ""}
        />
      </div>
      <div className="tp-field">
        <label htmlFor="tp-review-pass">Password</label>
        <input id="tp-review-pass" name="password" type="password" className="tp-input" autoComplete="current-password" required maxLength={200} />
      </div>
      {state.error && (
        <p className="tp-alert bad" role="alert" data-testid="review-error" style={{ margin: 0 }}>
          {state.error}
        </p>
      )}
      <button className="tp-btn block" disabled={pending} data-testid="review-submit">
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
