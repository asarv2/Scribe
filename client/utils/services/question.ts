/**
 * utils/services/question.ts
 * Will handle a user asking a question in the app.
 */
"use server";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

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
  tableName: "embeddings",
  queryName: "match_embeddings",
});

// Initialize the LLM (Gemini's model)
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash-8b", // Replace with the appropriate Gemini model name
  temperature: 0.7,
});


export const answerQuestion = async (question: string): Promise<{response: string, documents: string[]}> => {
  // Create a retriever

  try {
    const retriever = vectorStore.asRetriever({
      searchType: "similarity",
      k: 6,
    });

    // Create the RetrievalQA chain
    const prompt = ChatPromptTemplate.fromTemplate(`Answer the user's question: {input} based on the following context {context}`);

    const combineDocsChain = await createStuffDocumentsChain({
      llm,
      prompt,
    });

    const retrievalChain = await createRetrievalChain({
      combineDocsChain,
      retriever,
    });

    // Call the chain with the question
    const response = await retrievalChain.invoke({ input: question });
    const langchainDocs = response.context
    console.log(langchainDocs);
    const documents = langchainDocs.map((doc) => doc.metadata.document_id).filter((doc) => doc !== undefined);
    // Return the generated answer
    return {response: response.answer, documents: documents};
  } catch (error) {
    console.error(error);
    throw new Error("Failed to answer question");
  }
};


import OpenAI from "openai/index.mjs";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import useSupabaseServer from "../supabase/supabase-server";
import { cookies } from "next/headers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { DocData } from "../../types";
export const createQuestion = async (question: string) => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { "role": "user", "content": `Answer this question: ${question}` }
    ]
  });
  return completion.choices[0].message.content
}
