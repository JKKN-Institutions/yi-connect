"use client";

import { useState } from "react";
import { JoinForm } from "./join-form";
import { RegisterForm } from "./register-form";

type Mode = "register" | "code";

export function JoinDoors() {
  const [mode, setMode] = useState<Mode>("register");

  function tabClass(active: boolean) {
    return `flex-1 py-2.5 text-sm font-semibold rounded-md transition-colors ${
      active ? "bg-[#FD7215] text-white" : "text-white/60 hover:text-white"
    }`;
  }

  return (
    <div>
      <div className="flex gap-1 rounded-lg bg-white/5 p-1 mb-6 border border-white/10">
        <button type="button" onClick={() => setMode("register")} className={tabClass(mode === "register")}>
          Register
        </button>
        <button type="button" onClick={() => setMode("code")} className={tabClass(mode === "code")}>
          I have a code
        </button>
      </div>

      {mode === "register" ? (
        <RegisterForm />
      ) : (
        <div>
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">
              Enter Your <span className="text-[#FD7215]">Access Code</span>
            </h1>
            <p className="text-white/50 text-sm">
              Your code was sent with your YiFi registration confirmation.
            </p>
          </div>
          <JoinForm />
        </div>
      )}
    </div>
  );
}
