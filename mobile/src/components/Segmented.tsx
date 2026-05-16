import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/styles/theme";

type Option<T extends string> = {
  value: T;
  label: string;
};

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable key={option.value} style={[styles.tab, active && styles.active]} onPress={() => onChange(option.value)}>
            <Text style={styles.text}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: colors.line,
    borderRadius: 999,
    padding: 3,
  },
  tab: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
  },
  active: {
    backgroundColor: colors.panel,
    shadowColor: "#0f172a",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  text: {
    color: colors.ink,
    fontSize: 12,
  },
});
