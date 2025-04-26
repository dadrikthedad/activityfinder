// Her kobler vi oss opp på chatHuben vi har laget til chatHub. Her er og chatte-funksjonene, eventuelt flyttes for seg selv senere
"use client";

import { useEffect, useState } from "react";
import { createChatConnection, getChatConnection } from "@/utils/signalr/chatHub";
import * as signalR from "@microsoft/signalr";

export function useChat() {
  const [messages, setMessages] = useState<string[]>([]);
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);

  useEffect(() => {
    let conn = getChatConnection();

    if (!conn) {
      conn = createChatConnection();
    }

    setConnection(conn);

    if (conn && conn.state === signalR.HubConnectionState.Disconnected) {
      conn
        .start()
        .then(() => {
          console.log("✅ Connected to ChatHub");

          conn.on("ReceiveMessage", (message: string) => {
            console.log("📩 Received:", message);
            setMessages((prev) => [...prev, message]);
          });
        })
        .catch((error) => console.error("SignalR Connection Error:", error));
    }

    return () => {
      conn?.off("ReceiveMessage");
      conn?.stop();
    };
  }, []);

  const sendMessageToAll = async (message: string) => {
    if (connection) {
      try {
        await connection.invoke("SendMessageToAll", message);
      } catch (error) {
        console.error("Sending message failed:", error);
      }
    }
  };

  const sendMessageToUser = async (targetUserId: string, message: string) => {
    if (connection) {
      try {
        await connection.invoke("SendMessageToUser", targetUserId, message);
      } catch (error) {
        console.error("Sending private message failed:", error);
      }
    }
  };

  const sendMessageToGroup = async (groupName: string, message: string) => {
    if (connection) {
      try {
        await connection.invoke("SendMessageToGroup", groupName, message);
      } catch (error) {
        console.error("Sending group message failed:", error);
      }
    }
  };

  const joinGroup = async (groupName: string) => {
    if (connection) {
      try {
        await connection.invoke("JoinGroup", groupName);
      } catch (error) {
        console.error("Joining group failed:", error);
      }
    }
  };

  const leaveGroup = async (groupName: string) => {
    if (connection) {
      try {
        await connection.invoke("LeaveGroup", groupName);
      } catch (error) {
        console.error("Leaving group failed:", error);
      }
    }
  };

  return {
    messages,
    sendMessageToAll,
    sendMessageToUser,
    sendMessageToGroup,
    joinGroup,
    leaveGroup,
  };
}
