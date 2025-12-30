/**
 * AI features via OpenRouter API
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-3-haiku";

export interface AIOptions {
  model?: string;
  apiKey?: string;
}

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

async function callOpenRouter(
  messages: OpenRouterMessage[],
  options: AIOptions = {}
): Promise<string> {
  const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenRouter API key required. Set OPENROUTER_API_KEY environment variable or pass --api-key"
    );
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/RECTOR-LABS/youtube-transcript",
      "X-Title": "ytranscript",
    },
    body: JSON.stringify({
      model: options.model || DEFAULT_MODEL,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data: OpenRouterResponse = await response.json();

  if (data.error) {
    throw new Error(`OpenRouter error: ${data.error.message}`);
  }

  return data.choices[0]?.message?.content || "";
}

export async function summarize(
  transcript: string,
  options: AIOptions = {}
): Promise<string> {
  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: "You are a helpful assistant that summarizes video transcripts. Provide a clear, concise summary capturing the main points. Use bullet points for key takeaways.",
    },
    {
      role: "user",
      content: `Please summarize this video transcript:\n\n${transcript}`,
    },
  ];

  return callOpenRouter(messages, options);
}

export async function askQuestion(
  transcript: string,
  question: string,
  options: AIOptions = {}
): Promise<string> {
  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: "You are a helpful assistant that answers questions about video content based on the transcript provided. Be accurate and cite specific parts of the transcript when relevant.",
    },
    {
      role: "user",
      content: `Here is a video transcript:\n\n${transcript}\n\nQuestion: ${question}`,
    },
  ];

  return callOpenRouter(messages, options);
}

export async function translate(
  transcript: string,
  targetLanguage: string,
  options: AIOptions = {}
): Promise<string> {
  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `You are a professional translator. Translate the following transcript to ${targetLanguage}. Maintain the original meaning and tone. Only output the translation, no explanations.`,
    },
    {
      role: "user",
      content: transcript,
    },
  ];

  return callOpenRouter(messages, options);
}

export const AI_MODELS = {
  // Fast & cheap
  "haiku": "anthropic/claude-3-haiku",
  "gpt-3.5": "openai/gpt-3.5-turbo",
  "gemini-flash": "google/gemini-flash-1.5",

  // Balanced
  "sonnet": "anthropic/claude-3.5-sonnet",
  "gpt-4o-mini": "openai/gpt-4o-mini",

  // Best quality
  "opus": "anthropic/claude-3-opus",
  "gpt-4o": "openai/gpt-4o",
  "gemini-pro": "google/gemini-pro-1.5",
} as const;

export function resolveModel(shortName: string): string {
  return AI_MODELS[shortName as keyof typeof AI_MODELS] || shortName;
}
