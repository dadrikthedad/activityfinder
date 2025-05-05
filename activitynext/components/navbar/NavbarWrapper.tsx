"use client";

import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { ChatProvider } from "@/context/ChatContext";

export default function ChatAndNavbarWrapper() {
  const { userId } = useAuth();

  return (
    <ChatProvider key={userId ?? "anon"}>
      <Navbar key={userId ?? "anon"} />
    </ChatProvider>
  );
}