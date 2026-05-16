import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";

import { AuthProvider } from "@/auth/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
