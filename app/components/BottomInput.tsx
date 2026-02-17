// app/components/BottomInput.tsx

"use client";

import { useState } from "react";

export default function BottomInput() {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (!text.trim()) return;
    console.log("User input:", text);
    setText("");
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        padding: "1rem",
        background: "#000", // BLACK BACKGROUND
        borderTop: "1px solid #222",
        display: "flex",
        gap: "0.5rem"
      }}
    >
      <input
        type="text"
        placeholder="Type: I walked 5 km, I ate 2 chapatis..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        style={{
          flex: 1,
          padding: "0.75rem",
          borderRadius: "6px",
          border: "none",
          outline: "none",
          fontSize: "1rem",
          background: "#111",
          color: "#fff"
        }}
      />

      <button
        onClick={handleSubmit}
        style={{
          padding: "0.75rem 1.25rem",
          borderRadius: "6px",
          border: "none",
          background: "#fff",
          color: "#000",
          fontSize: "1rem",
          cursor: "pointer",
          fontWeight: "bold"
        }}
      >
        Send
      </button>
    </div>
  );
}