"use client";

import { useAuth } from "../context/AuthContext";
import AuthForm from "./AuthForm";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <span>Loading...</span>
      </div>
    );
  }
  if (!user) {
    return <AuthForm />;
  }
  return <>{children}</>;
}
