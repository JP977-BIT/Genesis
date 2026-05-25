"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  //Function that will handle the log in Validation
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Invalid credentials");
    } else {
      window.location.replace("/Home");
    }
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

          {/* Password field */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B3D35] focus:border-transparent transition"
            ></input>
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
