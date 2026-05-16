import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/styles/theme";

export function GradientScreen({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={[colors.pageTop, colors.pageBottom]} style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={["top", "left", "right"]}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

export function PlainScreen({ children }: { children: React.ReactNode }) {
  return (
    <View style={[styles.fill, styles.plain]}>
      <SafeAreaView style={styles.fill} edges={["top", "left", "right"]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  plain: {
    backgroundColor: "#f6f8fb",
  },
});
