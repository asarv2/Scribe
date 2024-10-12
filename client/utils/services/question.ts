/**
 * utils/services/question.ts
 * Will handle a user asking a question in the app.
 */
"use server";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";

// Create Supabase client
const cookieStore = cookies();
const supabase = useSupabaseServer(cookieStore);

const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004", // 768 dimensions
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    title: "Math Lecture Transcripts",
  });
  
const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: "documents",
  queryName: "match_documents",
});

// Answer question function with streaming
export const answerQuestion = async (question: string): Promise<string> => {
  const retriever = vectorStore.asRetriever({
    searchType: "similarity",
    k: 6,
  });

  const docs = await retriever.invoke(question);
  return docs.map((doc) => doc.pageContent).join("\n\n"); 
};


import OpenAI from "openai/index.mjs";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import useSupabaseServer from "../supabase/supabase-server";
import { cookies } from "next/headers";
export const createQuestion = async (question: string) => {
    const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});
    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { "role": "user", "content": `Answer this question: ${question}` }
        ]
    });
    return completion.choices[0].message.content
}
