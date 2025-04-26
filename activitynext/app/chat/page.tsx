// Chatte siden vi skal få en mer oversiktelig chat på en ved å trykke på chatdropdownen. Akkurat nå brukes den til test
"use client";

import { useChat } from "@/hooks/useChat";
import { useState } from "react";

export default function ChatPage() {
  const { messages, sendMessageToAll, joinGroup, sendMessageToGroup } = useChat();
  const [input, setInput] = useState("");
  const [groupName, setGroupName] = useState("");

  const handleSend = async () => {
    if (input.trim() !== "") {
      if (groupName.trim() !== "") {
        // Sender til en spesifikk gruppe hvis valgt
        await sendMessageToGroup(groupName, input);
      } else {
        // Sender til alle hvis ingen gruppe valgt
        await sendMessageToAll(input);
      }
      setInput("");
    }
  };

  const handleJoinGroup = async () => {
    if (groupName.trim() !== "") {
      await joinGroup(groupName);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>💬 Chat Page</h1>

      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Gruppe-navn (valgfritt)"
          style={{ marginRight: "1rem" }}
        />
        <button onClick={handleJoinGroup}>Bli med i gruppe</button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Skriv en melding..."
          style={{ marginRight: "1rem" }}
        />
        <button onClick={handleSend}>Send</button>
      </div>

      <div>
        <h2>Meldinger mottatt:</h2>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ borderBottom: "1px solid #ccc", marginBottom: "0.5rem" }}>
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}