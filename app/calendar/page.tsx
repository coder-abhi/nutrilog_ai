"use client";

import AuthGate from "../components/AuthGate";
import CalendarView from "../components/CalendarView";

export default function CalendarPage() {
  return (
    <AuthGate>
      <CalendarView />
    </AuthGate>
  );
}

