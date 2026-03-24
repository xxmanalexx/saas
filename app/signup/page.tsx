import Link from "next/link";
import { signIn } from "next-auth/react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function SignupPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00C853] text-black font-bold text-2xl mb-4">
            R
          </div>
          <h1 className="text-2xl font-bold text-white">Get started free</h1>
          <p className="text-white/40 mt-2">No credit card required. 50 conversations free.</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-4">
          <button
            onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
            className="w-full py-3 rounded-lg border border-white/10 text-white/80 font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-[#0A0F1C] text-white/30">or</span>
            </div>
          </div>

          <form className="space-y-3">
            <input
              type="email"
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00C853] transition-colors"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-[#00C853] text-black font-semibold hover:bg-[#00E676] transition-colors"
            >
              Sign up with email
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-white/40 hover:text-white transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
