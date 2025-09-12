// server.js
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import dotenv from "dotenv";
import { supabasePublic } from "./config/supabaseClient.js";
import { connectMongoDB } from "./config/mongoClient.js";
import {
  getNextInterviewQuestion,
  evaluateTranscript,
} from "./services/langchainService.js";

// Routes
import interviewRoute from "./routes/interviewRoutes.js";
import authRoute from "./routes/authRoutes.js";

dotenv.config();
connectMongoDB();

const app = express();
const httpServer = createServer(app);

// ✅ Allowed origins (no trailing slashes!)
const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:5173",
  "https://ai-interview-platfrom-2mc3hx3il-nitinpratap22061s-projects.vercel.app",
  "https://ai-interview-platfrom.vercel.app",
  "https://ai-interview-platfrom-5esb2h9ka-nitinpratap22061s-projects.vercel.app",
].filter(Boolean);

// ✅ CORS setup for Express
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("CORS violation"));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());

// Routes
app.use("/api/auth", authRoute);
app.use("/api/interviews", interviewRoute);

// ✅ Socket.IO with proper CORS
const io = new SocketServer(httpServer, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("CORS violation"));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ✅ Socket authentication middleware
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split?.(" ")[1];

    if (!token) return next(new Error("Auth token missing"));

    const { data, error } = await supabasePublic.auth.getUser(token);
    if (error || !data?.user) return next(new Error("Auth failed"));

    socket.user = data.user;
    next();
  } catch (err) {
    console.error("socket auth error", err);
    next(new Error("Auth failed"));
  }
});

// ✅ Socket connection logic (unchanged)
io.on("connection", (socket) => {
  console.log(`✅ Socket connected: ${socket.id} user: ${socket.user?.id}`);

  let questionCount = 0;
  const MAX_QUESTIONS = 5;
  let transcript = [];
  let interviewId = null;
  let topic = "";
  let startedAt = new Date();
  let lastQuestion = "";
  let interviewEnded = false;

  socket.on("startInterview", async ({ topic_id, topic_name }) => {
    try {
      let topicUUID = null;
      if (
        typeof topic_id === "string" &&
        /^[0-9a-fA-F-]{36}$/.test(topic_id)
      ) {
        topicUUID = topic_id;
      } else if (topic_name) {
        const { data: topicByName, error } = await supabasePublic
          .from("topics")
          .select("id,name")
          .ilike("name", topic_name)
          .single();
        if (error || !topicByName?.id) {
          socket.emit("error", { message: "Topic not found" });
          return;
        }
        topicUUID = topicByName.id;
        topic = topicByName.name;
      }

      startedAt = new Date();
      const { data: interview, error } = await supabasePublic
        .from("interviews")
        .insert({
          user_id: socket.user.id,
          topic_id: topicUUID,
          started_at: startedAt.toISOString(),
          transcript: [],
          ai_evaluation: {},
        })
        .select()
        .single();
      if (error) throw error;

      interviewId = interview.id;

      const firstQ = await getNextInterviewQuestion("", topic || topic_name, 0);
      questionCount = 1;
      lastQuestion = firstQ;

      socket.emit("interviewStarted", { interviewId });
      socket.emit("nextQuestion", { question: firstQ, questionNumber: 1 });
    } catch (err) {
      console.error("startInterview error:", err);
      socket.emit("error", { message: "Failed to start interview" });
    }
  });

  socket.on("submitAnswer", async ({ previousAnswer }) => {
    try {
      if (interviewEnded) return;

      const answerText = previousAnswer?.trim() || "";

      const abusiveWords = [
        "fuck",
        "shit",
        "bitch",
        "idiot",
        "stupid",
        "fool",
        "asshole",
        "dumb",
        "bastard",
        "crap",
        "screw you",
      ];
      const exitPhrases = [
        "end interview",
        "stop interview",
        "finish interview",
        "dont want to continue",
        "not interested",
        "quit",
        "dont want to give interview",
        "i want to end",
        "i will not tell you",
        "i am not telling",
        "no more questions",
      ];

      const lowerAnswer = answerText.toLowerCase();

      if (abusiveWords.some((w) => lowerAnswer.includes(w))) {
        const durationMins = Math.round((new Date() - startedAt) / 60000);
        const feedback = {
          overallScore: 0,
          strengths: [],
          areasToImprove: ["Used abusive language."],
          summary:
            "⚠️ Interview terminated immediately due to unprofessional or abusive language.",
          raw: "",
        };

        await supabasePublic
          .from("interviews")
          .update({
            transcript,
            completed_at: new Date().toISOString(),
            duration_mins: durationMins,
            score: 0,
            questions_count: transcript.length,
            ai_evaluation: feedback,
          })
          .eq("id", interviewId);

        interviewEnded = true;
        socket.emit("interviewFinished", {
          message: feedback.summary,
          ...feedback,
          transcript,
        });
        return;
      }

      if (
        exitPhrases.some((p) => lowerAnswer.includes(p)) ||
        lowerAnswer.includes("play cricket") ||
        lowerAnswer.includes("other topic")
      ) {
        const durationMins = Math.round((new Date() - startedAt) / 60000);

        const feedback = {
          overallScore: 0,
          strengths: [],
          areasToImprove: [
            "Candidate refused to answer or diverted from topic. Performance unacceptable.",
          ],
          summary:
            "⚠️ Interview ended due to candidate refusing/diverting from questions; performance considered very poor.",
          raw: "",
        };

        await supabasePublic
          .from("interviews")
          .update({
            transcript,
            completed_at: new Date().toISOString(),
            duration_mins: durationMins,
            score: 0,
            questions_count: transcript.length,
            ai_evaluation: feedback,
          })
          .eq("id", interviewId);

        interviewEnded = true;
        socket.emit("interviewFinished", {
          message: feedback.summary,
          ...feedback,
          transcript,
        });
        return;
      }

      transcript.push({ question: lastQuestion, answer: answerText });

      socket.emit("answerFeedback", {
        feedback:
          answerText.length >= 5
            ? "Good answer!"
            : "Answer too short, elaborate more.",
      });

      if (questionCount >= MAX_QUESTIONS) {
        const durationMins = Math.round((new Date() - startedAt) / 60000);
        const aiEval = await evaluateTranscript(transcript);

        await supabasePublic
          .from("interviews")
          .update({
            transcript,
            completed_at: new Date().toISOString(),
            duration_mins: durationMins,
            score: aiEval.overallScore,
            questions_count: transcript.length,
            ai_evaluation: aiEval,
          })
          .eq("id", interviewId);

        interviewEnded = true;
        socket.emit("interviewFinished", {
          message: "Interview complete!",
          ...aiEval,
          transcript,
        });
        return;
      }

      const nextQ = await getNextInterviewQuestion(
        answerText,
        topic,
        questionCount
      );
      questionCount++;
      lastQuestion = nextQ;

      socket.emit("nextQuestion", {
        question: nextQ,
        questionNumber: questionCount,
      });
    } catch (err) {
      console.error("submitAnswer error:", err);
      socket.emit("error", { message: "Failed while submitting answer" });
    }
  });

  socket.on("disconnect", () => console.log(`Disconnected: ${socket.id}`));
});

httpServer.listen(process.env.PORT || 5000, () =>
  console.log(`🚀 Server running on ${process.env.PORT || 5000}`)
);
