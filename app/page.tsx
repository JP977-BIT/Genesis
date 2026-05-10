"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

//Valid Credentials
const VALID_EMAIL = ["jp@revelation.co.za", "vernon@revelation.co.za"];
const VALID_PIN = "12345";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  //Function that will handle the log in Validation
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const validEmail = VALID_EMAIL.includes(email.toLowerCase().trim());
    const validPin = pin === VALID_PIN;

    if (!validEmail || !validPin) {
      setError("Invalid email or pin. Please try again.");
      return;
    }

    //Credentials are correct. Navigates to home page
    setError("");
    router.push("/Home");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#1B3D35]">
      {/* Branding Block */}
      <div className="flex flex-col items-center mb-8 gap-2">
        {/* Logo circle */}
        <div className="w-16 h-16 rounded-full bg-[#c8dbd6] flex items-center justify-center mb-2">
          <span className="text-[#1B3D35] font-semibold text-sm tracking-widest">
            GEN
          </span>
        </div>

        {/* App name */}
        <h1 className="text-white text-3xl font-semibold tracking-widest">
          GENESIS
        </h1>

        {/* Tagline */}
        <p className="text-[#7aada0] text-xs tracking-[0.25em] uppercase">
          Revelation Operations Suite
        </p>
      </div>

      {/* Sign-in Card */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8">
        <h2 className="text-gray-900 text-lg font-semibold mb-6">
          Sign in to your account
        </h2>

        <form onSubmit={handleSignIn} className="flex flex-col gap-4">
          {/* Email Field */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="email"
              className="text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@revelation.co.za"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B3D35] focus:border-transparent transition"
            />
          </div>

          {/* PIN Field */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="pin"
                className="text-sm font-medium text-gray-700"
              >
                PIN
              </label>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-[#1B3D35] transition"
              >
                Forgot?
              </button>
            </div>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B3D35] focus:border-transparent transition"
            />
          </div>

          {/* Error message */}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {/* Sign In Button */}
          <button
            type="submit"
            className="mt-2 w-full bg-[#1B3D35] hover:bg-[#15302a] text-white font-medium py-3 rounded-lg transition duration-200"
          >
            Sign in
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-8 text-[#5a8a80] text-xs">
        © 2026 Revelation. All rights reserved.
      </p>
    </main>
  );
}
