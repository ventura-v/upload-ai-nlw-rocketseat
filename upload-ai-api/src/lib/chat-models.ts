// importação para armazenar todas as variáveis do arquivo ".env" no "process.env" do Node
import "dotenv/config";
import { OpenAI } from "openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { GoogleGenAI } from "@google/genai";

export const openaiProvider = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

export const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const googleGenAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
