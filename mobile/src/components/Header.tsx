import { Ionicons } from "@expo/vector-icons";
import { Link, usePathname } from "expo-router";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/AuthContext";
import { colors } from "@/styles/theme";

const links = [
  { href: "/" as const, label: "Dashboard", match: "/", icon: "grid-outline" },
  { href: "/weight-tracker" as const, label: "Weight", match: "/weight-tracker", icon: "scale-outline" },
  { href: "/calendar" as const, label: "Calendar", match: "/calendar", icon: "calendar-outline" },
  { href: "/tracker" as const, label: "Tracker", match: "/tracker", icon: "checkbox-outline" },
  { href: "/profile/edit" as const, label: "Edit profile", match: "/profile/edit", icon: "create-outline" },
];

const goalLabels: Record<string, string> = {
  muscle_gain: "Muscle Gain",
  weight_loss: "Weight Loss",
  skin_health: "Skin Health",
  hair_growth: "Hair Growth",
  energy_boost: "Energy Boost",
  pcos: "PCOS / PCOD",
};

export function Header() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const userGoal = user?.goal ? goalLabels[user.goal] ?? user.goal : "";

  const closeMenu = () => setMenuOpen(false);
  const handleSignOut = async () => {
    closeMenu();
    await signOut();
  };

  return (
    <View style={styles.header}>
      <Text style={styles.brand}>Daily Log</Text>
      <Pressable style={styles.menuButton} onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Open menu">
        <Ionicons name="menu" size={25} color={colors.ink} />
      </Pressable>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={closeMenu}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeMenu} accessibilityRole="button" accessibilityLabel="Close menu" />
          <SafeAreaView style={styles.drawer} edges={["top", "right", "bottom"]}>
            <View style={styles.drawerTop}>
              <View style={styles.userCard}>
                <View style={styles.userIcon}>
                  <Ionicons name="person-outline" size={19} color={colors.blue} />
                </View>
                <View style={styles.userCopy}>
                  <Text style={styles.userLabel}>Current user</Text>
                  <Text style={styles.userName} numberOfLines={1}>
                    {user?.username ?? "Signed in"}
                  </Text>
                  {!!userGoal && <Text style={styles.userGoal}>{userGoal}</Text>}
                </View>
              </View>
              <Pressable style={styles.closeButton} onPress={closeMenu} accessibilityRole="button" accessibilityLabel="Close menu">
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>

            <View style={styles.nav}>
              {links.map((item) => {
                const active = item.match === "/" ? pathname === "/" : pathname.startsWith(item.match);
                return (
                  <Link key={item.href} href={item.href} asChild>
                    <Pressable style={[styles.menuItem, styles.navLink, active && styles.navLinkActive]} onPress={closeMenu}>
                      <View style={styles.navLinkContent}>
                        <View style={styles.navIconFrame}>
                          <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={19} color={active ? colors.red : colors.inkSoft} />
                        </View>
                        <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
                      </View>
                    </Pressable>
                  </Link>
                );
              })}

              <Pressable style={[styles.menuItem, styles.signOut]} onPress={handleSignOut}>
                <View style={styles.navLinkContent}>
                  <View style={styles.navIconFrame}>
                    <Ionicons name="log-out-outline" size={19} color={colors.red} />
                  </View>
                  <Text style={styles.signOutText}>Sign out</Text>
                </View>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 60,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 12,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  menuButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  modalRoot: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.36)",
  },
  drawer: {
    width: "84%",
    maxWidth: 360,
    backgroundColor: colors.panel,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowOffset: { width: -12, height: 0 },
    shadowRadius: 28,
    elevation: 12,
  },
  drawerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  userCard: {
    flex: 1,
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
  },
  userIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  userCopy: {
    flex: 1,
    minWidth: 0,
  },
  userLabel: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  userName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  userGoal: {
    color: colors.muted,
    fontSize: 13,
  },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  nav: {
    width: "100%",
  },
  menuItem: {
    width: "100%",
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 0,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  navLink: {
    borderColor: "#fee2e2",
    backgroundColor: colors.redSoft,
    marginBottom: 12,
  },
  navLinkContent: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  navIconFrame: {
    width: 20,
    height: 20,
    marginRight: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  navLinkActive: {
    backgroundColor: colors.redSoft,
    borderColor: "#fecaca",
  },
  navText: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 18,
  },
  navTextActive: {
    color: colors.red,
  },
  signOut: {
    borderColor: "#fee2e2",
    backgroundColor: colors.redSoft,
    marginBottom: 0,
  },
  signOutText: {
    flexShrink: 1,
    color: colors.red,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 18,
  },
});
