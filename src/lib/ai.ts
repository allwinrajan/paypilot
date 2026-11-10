// The ONLY place the app talks to an AI provider.
// Everything else calls generateText() / generateJSON(), so the provider can be swapped
// by editing just this file. Current provider: Google Gemini (official @google/genai SDK).
//
// Reminder (CLAUDE.md core rule): the AI only writes wording and proposes data.
// Guardrails are checked in plain code by the caller AFTER generateJSON() returns.
import "server-only";
import { GoogleGenAI } from "@google/genai";

export class AIError extends Error {}

let client: GoogleGenAI | null = null;

function getConfig() {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!apiKey || !model) {
    throw new AIError("AI_API_KEY / AI_MODEL are not set. Add them to your .env file.");
  }
  client ??= new GoogleGenAI({ apiKey });
  return { client, model };
}

export interface GenerateTextInput {
  system?: string;
  prompt: string;
  /** Ask the provider for a JSON-only reply (use generateJSON() for parsing + retry). */
  json?: boolean;
}

export async function generateText({ system, prompt, json }: GenerateTextInput): Promise<string> {
  const { client, model } = getConfig();
  try {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        ...(system ? { systemInstruction: system } : {}),
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    });
    const text = response.text;
    if (!text) throw new AIError("The AI returned an empty reply.");
    return text;
  } catch (err) {
    if (err instanceof AIError) throw err;
    throw new AIError(`AI request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Removes ```json ... ``` fences and any text around the outermost JSON object/array. */
export function extractJSON(text: string): unknown {
  let s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = s.search(/[{[]/);
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (start === -1 || end < start) throw new SyntaxError("No JSON found in reply");
  s = s.slice(start, end + 1);
  return JSON.parse(s);
}

export interface GenerateJSONInput<T> {
  system?: string;
  prompt: string;
  /** Plain-code shape check. Return the typed value, or throw an Error saying what is wrong. */
  validate: (data: unknown) => T;
}

const JSON_RULES =
  "Reply with ONE valid JSON value only. No markdown, no code fences, no comments, no text before or after it.";

/**
 * Asks for strict JSON, parses it safely, validates its shape, and retries once
 * (telling the model what was wrong). Throws AIError with a clear message if both tries fail.
 */
export async function generateJSON<T>({ system, prompt, validate }: GenerateJSONInput<T>): Promise<T> {
  const fullSystem = system ? `${system}\n\n${JSON_RULES}` : JSON_RULES;
  let lastProblem = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const retryNote =
      attempt === 1 ? "" : `\n\nYour previous reply was rejected: ${lastProblem}. Return corrected JSON only.`;
    const text = await generateText({ system: fullSystem, prompt: prompt + retryNote, json: true });
    try {
      return validate(extractJSON(text));
    } catch (err) {
      lastProblem = err instanceof Error ? err.message : String(err);
    }
  }
  throw new AIError(`The AI did not return usable data after 2 tries (${lastProblem}). Please rephrase and try again.`);
}
