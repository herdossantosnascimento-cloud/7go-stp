import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="customer-auth-page">
          <section className="customer-auth-card">
            <p>A carregar...</p>
          </section>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
