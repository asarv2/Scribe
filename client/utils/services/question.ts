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
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

const {
  GoogleGenerativeAI,
} = require("@google/generative-ai");

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Create Supabase client
const cookieStore = cookies();
const supabase = useSupabaseServer(cookieStore);

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004", // 768 dimensions
  taskType: TaskType.RETRIEVAL_DOCUMENT,
  title: "Math Lecture Transcripts",
});

// Initialize the LLM (Gemini's model)
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash-8b", // Replace with the appropriate Gemini model name
  temperature: 0.7,
});


export const answerQuestion = async (question: string): Promise<{ response: string, documents: string[] }> => {
  // Create a retriever
  try {

    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase,
      tableName: "embeddings_lecture",
      queryName: "match_embeddings_lecture",
    });

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
    return { response: response.answer, documents: documents };
  } catch (error) {
    console.error(error);
    throw new Error("Failed to answer question");
  }
};


export const findRelevantNoteDocuments = async (question: string): Promise<string[]> => {
  const vectorStore = new SupabaseVectorStore(embeddings, {
    client: supabase,
    tableName: "embeddings_slide",
    queryName: "match_embeddings_slide",
  });

  const retriever = vectorStore.asRetriever({
    searchType: "similarity",
    k: 3,
  });
  // find the documents that match closest to the question
  const langchainDocs = await retriever.invoke(question)
  console.log(langchainDocs);
  const documents = langchainDocs.map((doc) => doc.metadata.document_id).filter((doc) => doc !== undefined);
  return documents;
}



export const answerSlideQuestion = async (question: string, context: string, imageUrls: string[]): Promise<{ response: string }> => {
  // prompting gemini with all information
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-8b",
      systemInstruction: "You the teacher of the class: , teaching the following lecture on the topic: . Students will ask questions about the lecture content, which will be provided below. You emphasize teaching the theory and how the content works, rather than providing a solution, since you do not know the extent of the student's knowledge. Be sure to respond with an answer that is clear and concise, while still being through.",
    });

    const images = await Promise.all(imageUrls.map(async (url) => {
      const response = await fetch(url);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64String = Buffer.from(arrayBuffer).toString('base64');
      return {
        inlineData: {
          data: base64String,
          mimeType: "image/png",
        },
      }
    }));

    const prompt = "Answer the student's question: " + question + " based on the following context: " + context;
    const result = await model.generateContent([prompt, ...images]);
    const rawOutput = result.response.text()
    return { response: rawOutput };

  } catch (error) {
    console.error(error);
    return { response: "Could not answer question" };
  }


}


export const answerTextbookQuestion = async (question: string): Promise<{ response: string, documents: string[] }> => {
  // Create a retriever
  try {

    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase,
      tableName: "embeddings_textbook",
      queryName: "match_embeddings_textbook",
    });

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
    return { response: response.answer, documents: documents };
  } catch (error) {
    console.error(error);
    throw new Error("Failed to answer question");
  }
};
