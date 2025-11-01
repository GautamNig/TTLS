// src/components/AuthPage.jsx
import React from "react";
import GoogleIcon from "./GoogleIcon";

export default function AuthPage({ onSignIn }) {
  return (
    <div className="min-h-screen bg-night-sky flex items-center justify-center">
      <div className="bg-black/70 p-8 rounded-md text-center text-white">
        <h1 className="text-2xl mb-2">✨ TTLS</h1>
        <p className="mb-4">Join the Night Sky</p>
        <button onClick={onSignIn} className="px-4 py-2 rounded-md bg-white text-gray-800 font-semibold flex items-center gap-2">
          <GoogleIcon />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
