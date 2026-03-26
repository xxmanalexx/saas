import LoginClient from "./LoginClient";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0F1C]" />}>
      <LoginClient />
    </Suspense>
  );
}
