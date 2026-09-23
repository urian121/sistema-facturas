export const CHAT_URL = "https://api.openai.com/v1/chat/completions";
export const EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

/** El mismo modelo de visión sirve para extraer y para responder preguntas. */
export const MODELO = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";

/** Se lee en cada petición, no al cargar el módulo, para respetar el entorno vivo. */
export function claveOpenAI(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

export function cabeceras(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}
