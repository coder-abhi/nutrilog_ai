"use client";

import AuthGate from "../components/AuthGate";
import WeightTracker from "../components/WeightTracker";

export default function WeightTrackerPage() {
  return (
    <AuthGate>
      <WeightTracker />
    </AuthGate>
  );
}

