import { ChatGoogleGenerativeAI } from "npm:@langchain/google-genai";
import { HumanMessage } from "npm:@langchain/core/messages";

export enum ContentType {
  LECTURE = "lecture",
  TOPIC = "topic"
}

export class BaseProcessor {
  public llmGeminiPro: ChatGoogleGenerativeAI;
  public llmGeminiFlash: ChatGoogleGenerativeAI;
  public llmGeminiFlash8b: ChatGoogleGenerativeAI;

  constructor(apiKey: string) {
    // Initialize LangChain models
    this.llmGeminiPro = new ChatGoogleGenerativeAI({
      apiKey: apiKey,
      modelName: "gemini-1.5-pro",
      temperature: 0,
      maxOutputTokens: undefined,
      maxRetries: 2,
    });

    this.llmGeminiFlash = new ChatGoogleGenerativeAI({
      apiKey: apiKey,
      modelName: "gemini-1.5-flash",
      temperature: 0,
      maxOutputTokens: undefined,
      maxRetries: 2,
    });

    this.llmGeminiFlash8b = new ChatGoogleGenerativeAI({
      apiKey: apiKey,
      modelName: "gemini-1.5-flash-8b",
      temperature: 0,
      maxOutputTokens: undefined,
      maxRetries: 2,
    });
  }

  async robustGenerate(message: HumanMessage, retries = 5, initialWait = 5): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Try Gemini Flash first
        try {
          const response = await this.llmGeminiFlash.generate([[message]]);
          return response.generations[0][0].text;
        } catch (flashError) {
          // If Flash fails with RECITATION error, try Pro
          if (flashError.message.includes("RECITATION")) {
            console.log("Gemini Flash blocked due to RECITATION, trying Gemini Pro...");
            const proResponse = await this.llmGeminiPro.generate([[message]]);
            return proResponse.generations[0][0].text;
          }
          throw flashError; // Re-throw if it's not a RECITATION error
        }
      } catch (error) {
        lastError = error;

        const shouldRetry = 
          error.message.includes("ResourceExhausted") ||
          error.message.toLowerCase().includes("rate_limit") ||
          error.message.toLowerCase().includes("too many requests") ||
          error.message.toLowerCase().includes("quota exceeded");

        if (shouldRetry && attempt < retries - 1) {
          const waitTime = initialWait * (1.5 ** attempt);
          console.log(`Attempt ${attempt + 1}/${retries} failed. Retrying in ${waitTime.toFixed(1)} seconds...`);
          console.log(`Error: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          continue;
        }
        break;
      }
    }

    throw new Error(`Failed after ${retries} attempts. Last error: ${lastError?.message}`);
  }
}
