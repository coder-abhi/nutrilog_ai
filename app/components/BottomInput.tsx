// app/components/BottomInput.tsx

"use client";

import { useState } from "react";

export default function BottomInput() {
//   const [text, setText] = useState("");

//   const handleSubmit = () => {
//     if (!text.trim()) return;
//     console.log("User input:", text);
//     setText("");
//   };

const [input, setInput] = useState("");
const [result, setResult] = useState("null");
const [llmInput, setLlmInput] = useState("");

   

    
  const calculateCalories = async () => {
    if (!input.trim()) return;
    setResult("Calculating...");
    setLlmInput(input)
    setInput("")
      try {
      const response = await fetch("http://127.0.0.1:8000/calories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sentence: llmInput })
      });
  
      const data = await response.json();
      console.log(data);
      setResult(data);
      
      setResult(data.toString());
      setInput("");
    } catch (error) {
      console.error("Error: " + error);
    }
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
      Helllooooooooo
      {result && <p>Calories burned: {result}</p>}
      <input
        type="text"
        placeholder="Type: I walked 5 km, I ate 2 chapatis..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && calculateCalories()}
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
        onClick={calculateCalories}
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
        Submit
      </button>
    </div>
  );
};
