import { Link, usePathname } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthContext";
import { colors } from "@/styles/theme";

const links = [
  { href: "/" as const, label: "Dashboard", match: "/" },
  { href: "/weight-tracker" as const, label: "Weight", match: "/weight-tracker" },
  { href: "/calendar" as const, label: "Calendar", match: "/calendar" },
  { href: "/tracker" as const, label: "Tracker", match: "/tracker" },
];

export function Header() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <View style={styles.header}>
      <Text style={styles.brand}>Daily Log</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>
        {links.map((item) => {
          const active = item.match === "/" ? pathname === "/" : pathname.startsWith(item.match);
          return (
            <Link key={item.href} href={item.href} asChild>
              <Pressable style={[styles.navLink, active && styles.navLinkActive]}>
                <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
              </Pressable>
            </Link>
          );
        })}
        <View style={styles.userSection}>
          <Text style={styles.userName}>{user?.username}</Text>
          <Pressable style={styles.signOut} onPress={signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.06)",
  },
  brand: {
    marginLeft: 16,
    marginBottom: 9,
    color: colors.ink,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  nav: {
    gap: 7,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  navLink: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  navLinkActive: {
    backgroundColor: colors.ink,
  },
  navText: {
    color: colors.ink,
    fontSize: 13,
  },
  navTextActive: {
    color: colors.panel,
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  userName: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.43)",
    color: colors.panel,
    fontSize: 13,
  },
  signOut: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  signOutText: {
    color: colors.inkSoft,
    fontSize: 13,
  },
});
