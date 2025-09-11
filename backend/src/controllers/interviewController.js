// controllers/interviewController.js
import { supabasePublic } from "../config/supabaseClient.js";
import { evaluateTranscript } from "../services/langchainService.js";

/**
 * Utility: check if string looks like UUID v4
 */
const looksLikeUUID = (s) =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/**
 * Resolve topic_id: if UUID return it, else resolve by numeric id or topic_name
 */
const resolveTopicUUID = async ({ topic_id, topic_name }) => {
  try {
    if (looksLikeUUID(topic_id)) return { id: topic_id };

    if (topic_id && !isNaN(topic_id)) {
      const { data, error } = await supabasePublic
        .from("topics")
        .select("id")
        .eq("id", topic_id)
        .single();
      if (!error && data?.id) return { id: data.id };
    }

    if (topic_name) {
      const { data, error } = await supabasePublic
        .from("topics")
        .select("id")
        .ilike("name", topic_name)
        .single();
      if (!error && data?.id) return { id: data.id };
      return { errorMessage: "Topic not found by name" };
    }

    return { errorMessage: "Invalid topic_id and no topic_name provided" };
  } catch (err) {
    console.error("resolveTopicUUID error:", err);
    return { errorMessage: "Error resolving topic" };
  }
};

/**
 * Start a new interview
 */
export const startInterview = async (req, res) => {
  try {
    const user = req.user;
    const { topic_id, topic_name } = req.body;

    const resolved = await resolveTopicUUID({ topic_id, topic_name });
    if (resolved.errorMessage) {
      return res.status(400).json({ error: resolved.errorMessage });
    }

    const topicUUID = resolved.id;

    const { data, error } = await supabasePublic
      .from("interviews")
      .insert([
        {
          user_id: user.id,
          topic_id: topicUUID,
          started_at: new Date().toISOString(),
          transcript: [],
          ai_evaluation: {
            overallScore: 0,
            strengths: [],
            areasToImprove: [],
            summary: "",
            raw: "",
          },
          score: 0,
          duration_mins: 0,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error (startInterview):", error);
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  } catch (err) {
    console.error("startInterview error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get interview history for a user
 */
export const getInterviewHistory = async (req, res) => {
  try {
    const user = req.user;
    const { data, error } = await supabasePublic
      .from("interviews")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false });

    if (error) {
      console.error("Supabase select error (getInterviewHistory):", error);
      return res.status(500).json({ error: error.message });
    }

    return res.json(data || []);
  } catch (err) {
    console.error("getInterviewHistory error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get a random question for a topic
 */
export const getQuestion = async (req, res) => {
  try {
    const { topic_id } = req.query;
    if (!topic_id) {
      return res.status(400).json({ error: "topic_id is required" });
    }

    const { data: questions, error } = await supabasePublic
      .from("questions")
      .select("*")
      .eq("topic_id", topic_id);

    if (error) {
      console.error("Supabase error (getQuestion):", error);
      return res.status(500).json({ error: error.message });
    }

    if (!questions || questions.length === 0) {
      return res.status(404).json({ error: "No questions found for this topic" });
    }

    const randomQuestion =
      questions[Math.floor(Math.random() * questions.length)];
    return res.json(randomQuestion);
  } catch (err) {
    console.error("getQuestion error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Submit transcript for AI evaluation
 */
export const submitInterviewForEvaluation = async (req, res) => {
  try {
    const { interviewId, transcript } = req.body;
    if (!interviewId || !transcript) {
      return res
        .status(400)
        .json({ error: "interviewId and transcript are required" });
    }

    // Normalize transcript into array of {question, answer}
    const safeTranscript = Array.isArray(transcript)
      ? transcript.map((t) =>
          typeof t === "string"
            ? { question: "N/A", answer: t }
            : { question: t.question || "N/A", answer: t.answer || "" }
        )
      : [{ question: "N/A", answer: String(transcript) }];

    // Run AI evaluation
    const evaluation = await evaluateTranscript(safeTranscript);

    // Update and return interview row
    const { data, error: updateError } = await supabasePublic
      .from("interviews")
      .update({
        transcript: safeTranscript,
        ai_evaluation: evaluation,
        score: evaluation.overallScore,
        completed_at: new Date().toISOString(),
      })
      .eq("id", interviewId)
      .select()
      .single();

    if (updateError) {
      console.error(
        "Supabase update error (submitInterviewForEvaluation):",
        updateError
      );
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({
      success: true,
      interview: data,
    });
  } catch (err) {
    console.error("submitInterviewForEvaluation error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
