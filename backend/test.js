import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

// When connected
socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);

  // Start interview
  socket.emit("startInterview", { topic: "javascript" });
});

// Receive first/next questions
socket.on("nextQuestion", (data) => {
  console.log("📌 New Question:", data.question);

  // Example: simulate answering after 2s
  setTimeout(() => {
    socket.emit("submitAnswer", { previousAnswer: "My answer", topic: "javascript" });
  }, 2000);
});

// Handle disconnect
socket.on("disconnect", () => {
  console.log("❌ Disconnected");
});
