import { GoogleGenAI } from "@google/genai";
import type { TriageResponse } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

const CRITICAL_KEYWORDS = [
  "unconscious", "not breathing", "no pulse", "severe bleeding",
  "chest pain", "stroke", "heart attack", "choking", "severe burn",
  "head injury", "seizure", "poisoning", "suicide"
];

function ruleBasedFallback(symptoms: string): TriageResponse {
  const lowerSymptoms = symptoms.toLowerCase();
  const hasCritical = CRITICAL_KEYWORDS.some(keyword => lowerSymptoms.includes(keyword));
  
  if (hasCritical) {
    return {
      type: "CRITICAL_EMERGENCY",
      urgency_score: 10,
      medical_flags: ["IMMEDIATE_MEDICAL_ATTENTION_REQUIRED"],
      first_aid: [
        "Call emergency services immediately (999 or local emergency number)",
        "Do not move the patient unless in immediate danger",
        "Monitor breathing and pulse",
        "Be prepared to perform CPR if needed"
      ],
      summary_for_rescue_en: "Critical emergency detected. Immediate medical intervention required.",
      summary_for_rescue_bn: "জরুরি জীবন-হুমকি পরিস্থিতি সনাক্ত করা হয়েছে। অবিলম্বে চিকিৎসা প্রয়োজন।",
      suggested_equipment: ["AED", "Oxygen", "Trauma kit", "IV supplies"],
      confidence: 0.95
    };
  }

  return {
    type: "GENERAL_CONSULTATION",
    urgency_score: 5,
    medical_flags: ["MONITORING_RECOMMENDED"],
    first_aid: [
      "Rest and monitor symptoms",
      "Stay hydrated",
      "Seek medical consultation if symptoms worsen"
    ],
    summary_for_rescue_en: "General symptoms reported. Monitoring recommended.",
    summary_for_rescue_bn: "সাধারণ লক্ষণ রিপোর্ট করা হয়েছে। পর্যবেক্ষণ প্রয়োজন।",
    suggested_equipment: ["Basic first aid kit"],
    confidence: 0.7
  };
}

export async function analyzeTriage(symptoms: string): Promise<TriageResponse> {
  try {
    const systemPrompt = `You are an emergency triage AI system. Analyze patient symptoms and provide structured medical assessment.

CRITICAL: Your response MUST be valid JSON matching this exact structure:
{
  "type": "string (one of: CRITICAL_EMERGENCY, URGENT, MODERATE, MINOR)",
  "urgency_score": number (1-10, where 10 is life-threatening),
  "medical_flags": ["array of medical concerns"],
  "first_aid": ["array of immediate actions"],
  "summary_for_rescue_en": "English summary for emergency responders",
  "summary_for_rescue_bn": "Bengali summary for emergency responders",
  "suggested_equipment": ["array of medical equipment needed"],
  "confidence": number (0-1, your confidence in assessment)
}

Scoring guide:
- 9-10: Life-threatening (unconscious, not breathing, severe bleeding, chest pain)
- 7-8: Urgent (high fever, severe pain, difficulty breathing)
- 4-6: Moderate (moderate pain, persistent symptoms)
- 1-3: Minor (mild symptoms, general consultation)`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            type: { type: "string" },
            urgency_score: { type: "number" },
            medical_flags: { type: "array", items: { type: "string" } },
            first_aid: { type: "array", items: { type: "string" } },
            summary_for_rescue_en: { type: "string" },
            summary_for_rescue_bn: { type: "string" },
            suggested_equipment: { type: "array", items: { type: "string" } },
            confidence: { type: "number" }
          },
          required: [
            "type", "urgency_score", "medical_flags", "first_aid",
            "summary_for_rescue_en", "summary_for_rescue_bn",
            "suggested_equipment", "confidence"
          ]
        }
      },
      contents: `Patient symptoms: ${symptoms}`
    });

    const rawJson = response.text;
    
    if (!rawJson) {
      console.warn("Empty response from Gemini, using rule-based fallback");
      return ruleBasedFallback(symptoms);
    }

    const data: TriageResponse = JSON.parse(rawJson);
    
    if (!data.type || typeof data.urgency_score !== 'number' || 
        !Array.isArray(data.medical_flags) || !Array.isArray(data.first_aid)) {
      console.warn("Invalid Gemini response structure, using rule-based fallback");
      return ruleBasedFallback(symptoms);
    }

    return data;
  } catch (error) {
    console.error("Gemini API error:", error);
    console.log("Falling back to rule-based triage");
    return ruleBasedFallback(symptoms);
  }
}

export async function chatWithAI(message: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: `As a medical AI assistant, provide helpful guidance for: ${message}\n\nNote: This is not a substitute for professional medical advice.`
    });

    return response.text || "I apologize, but I couldn't process your request. Please try again or contact emergency services if this is urgent.";
  } catch (error) {
    console.error("Gemini chat error:", error);
    return "I'm having trouble connecting right now. For emergencies, please call your local emergency number immediately.";
  }
}
