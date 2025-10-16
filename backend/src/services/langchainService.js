// services/langchainService.js
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL_NAME = process.env.GROQ_MODEL_NAME;

/**
 * Generate the next interview question
 */
/**
 * Generate the next interview question
 */
/**
 * Generate the next interview question
 */
export const getNextInterviewQuestion = async (
  previousAnswer,
  topic,
  questionCount
) => {
  try {
    const messages = [
      {
        role: "system",
        content: `You are Virat, a professional HR interviewer at "Nitin Private Limited" conducting a real interview for a junior developer position. 
Your goal is to simulate a realistic, professional hiring interview. Follow these rules strictly:

1. Ask clear, concise, and relevant technical or behavioral questions based on the topic: "${topic}".
2. Maintain a professional, polite, and human-like demeanor at all times.
3. Never act like a guide, tutor, or helper. Treat the candidate as a real job applicant.
4. Monitor the candidate's responses. If the candidate uses unprofessional, abusive, or offensive language, issue **one polite warning** and remind them that continued misbehavior will end the interview.
5. If the candidate continues to misbehave after a warning, indicate that the interview is being terminated due to unprofessional conduct.
6. If the candidate attempts to divert the conversation or refuses to answer, politely try to refocus them. If diversion continues, terminate the interview professionally.
7. Ignore any special characters (e.g., *, ?, !, @) in the candidate's answers and focus only on the meaningful content of their response.
8. Adapt naturally to the candidate's previous answers, but do not rely solely on them. Introduce follow-ups or new relevant questions.
9. Provide constructive feedback only when appropriate, keeping it brief and professional.
10. Keep the conversation flow realistic, professional, and concise. Avoid artificial phrasing or off-topic guidance.
11. Your role is strictly that of Burchatta, the HR interviewer for Nitin Private Limited; do not provide explanations, tutorials, or step-by-step guidance.` 
      },
      {
        role: "user",
        content: `Previous answer: "${previousAnswer}".  
Please generate interview question number ${questionCount + 1}.`
      },
    ];

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: GROQ_MODEL_NAME,
        messages,
        max_tokens: 200,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const choice = response.data?.choices?.[0]?.message?.content;
    return choice ? choice.trim() : "⚠️ Could not generate question.";
  } catch (error) {
    console.error(
      "Groq API error (getNextInterviewQuestion):",
      error.response?.data || error.message || error
    );
    return "⚠️ Could not generate question at this time.";
  }
};




/**
 * Evaluate the entire transcript and return structured JSON
 */
/**
 * Evaluate the entire transcript and return structured JSON
 */
export const evaluateTranscript = async (transcript) => {
  try {
    const formattedTranscript = transcript
      .map((q, idx) => `Q${idx + 1}: ${q.question}\nA: ${q.answer}`)
      .join("\n\n");

    const messages = [
      {
        role: "system",
        content: `You are an AI interview evaluator. Your task is to assess the candidate's performance based on the provided transcript. 
Follow these instructions strictly:

1. Respond ONLY in valid JSON format with the following fields:
{
  "overallScore": number (0–10),
  "strengths": string[],
  "areasToImprove": string[],
  "summary": string
}

2. "overallScore": Give a numeric score representing overall performance, where 0 is poor and 10 is excellent.  
   - If the candidate refuses to answer, diverts from the topic, ends the interview early, or uses abusive language, **give 0 score** and mark performance as very poor.

3. "strengths": List key positive aspects only if the candidate gave meaningful answers; otherwise, leave empty.

4. "areasToImprove": List specific areas for improvement. If candidate refused or diverted, indicate "Candidate did not provide relevant answers" or "Unprofessional behavior observed".

5. "summary": Provide a concise professional summary highlighting performance quality. If candidate misbehaved or diverted, clearly state "Interview ended due to unprofessional/diverted responses; performance unacceptable."

6. Ignore any special characters in the candidate's answers; focus on meaningful content only.

Do not add any extra text outside the JSON. Be strict, professional, and objective.`
      },
      {
        role: "user",
        content: `Evaluate the following interview transcript:

${formattedTranscript}

Return output as valid JSON only.`
      },
    ];

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: GROQ_MODEL_NAME,
        messages,
        max_tokens: 400,
        temperature: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const raw = response.data?.choices?.[0]?.message?.content?.trim();

    let structured = {
      overallScore: 0,
      strengths: [],
      areasToImprove: [],
      summary: "No evaluation available.",
      raw: raw || "",
    };

    try {
      const parsed = JSON.parse(raw);

      structured = {
        overallScore:
          parsed.overallScore ?? parsed.overall_score ?? parsed.score ?? 0,
        strengths:
          parsed.strengths ?? parsed.Strengths ?? parsed.positives ?? [],
        areasToImprove:
          parsed.areasToImprove ?? parsed.areas_to_improve ?? parsed.weaknesses ?? [],
        summary: parsed.summary ?? parsed.feedback ?? "No summary provided.",
        raw,
      };
    } catch (e) {
      console.warn("⚠️ Failed to parse evaluation JSON:", raw);

      structured = {
        overallScore: 0,
        strengths: [],
        areasToImprove: ["Candidate did not provide relevant answers or misbehaved."],
        summary: "⚠️ Interview ended due to unprofessional/diverted responses; performance unacceptable.",
        raw,
      };
    }

    // Ensure score is between 0–10
    if (structured.overallScore < 0) structured.overallScore = 0;
    if (structured.overallScore > 10) structured.overallScore = 10;

    return structured;
  } catch (error) {
    console.error(
      "Groq API error (evaluateTranscript):",
      error.response?.data || error.message || error
    );
    return {
      overallScore: 0,
      strengths: [],
      areasToImprove: ["Evaluation failed due to system error."],
      summary: "⚠️ Evaluation failed",
      raw: "",
    };
  }
};
