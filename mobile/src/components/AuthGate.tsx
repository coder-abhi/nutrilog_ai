import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/auth/AuthContext";
import { AuthForm } from "@/components/AuthForm";
import { GradientScreen } from "@/components/Screen";
import { colors } from "@/styles/theme";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <GradientScreen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </GradientScreen>
    );
  }

  if (!user) return <AuthForm />;

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
