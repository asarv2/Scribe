/**
 * utils/services/gemini.ts
 * Will handle a user asking questions to gemini.
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
import { BaseMessage, BaseMessageLike } from '@langchain/core/messages';
import { Slide, SlideData, Summary, Topic } from "@/types";
import { MapNode } from "../map/map-tree";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from 'uuid';
import { Document } from "@langchain/core/documents";

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey as string);

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


export const generateSummary = async (className: string, textSummaries: string[], imgPaths: string[]): Promise<string | undefined> => {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-8b",
    systemInstruction: `You are an deep expert in: ${className}, with knowledge upto the PhD level.`,
  });

  const images = await Promise.all(imgPaths.map(async (url) => {
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

  const interleavedContent = textSummaries.flatMap((textSummary, index) => {
    return [(`Page ${index + 1}: ${textSummary}`), images[index]];
  });

  const prompt = `Please provide a thorough analysis of this document, including both text and visual elements. Focus on:
        1. Main concepts and ideas from the text
        2. Description and interpretation of any diagrams, charts, or visual elements
        3. How the visual elements support or illustrate the text content
        4. Any important symbols, notations, or visual patterns and their meanings
        5. The overall relationship between textual and visual information
        6. Include easy to understand definitions of key terms
        7. If possible include easy to understand examples of this being applied in the world, or with things similar in the real world`;

  const result = await model.generateContent([prompt, ...interleavedContent]);
  const rawOutput = result.response.text()
  return rawOutput;
};

export const regenerateSummary = async (classId: string, className: string, documents: SlideData[], previousSummaries: Summary[]): Promise<string | null> => {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-8b",
    systemInstruction: `You are an deep expert in: ${className}, with knowledge upto the PhD level.`,
  });

  const images = await Promise.all(documents.map(async (document) => {
    const img_url = `https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/lectures/${classId}/${document.slide}/page_${document.page}.png`
    const response = await fetch(img_url);
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

  const interleavedContent = documents.flatMap((document, index) => {
    return [(`Page ${index + 1}: ${document.content}`), images[index]];
  });

  const lastSummary = previousSummaries[previousSummaries.length - 1];
  const prompt = `Regenerate the follwing prompt, but take a different approach to what your response was last time. LAST RESPONSE: ${lastSummary}. YOUR PROMPT: Please provide a thorough analysis of this document, including both text and visual elements. Focus on:
        1. Main concepts and ideas from the text
        2. Description and interpretation of any diagrams, charts, or visual elements
        3. How the visual elements support or illustrate the text content
        4. Any important symbols, notations, or visual patterns and their meanings
        5. The overall relationship between textual and visual information
        6. Include easy to understand definitions of key terms
        7. If possible include easy to understand examples of this being applied in the world, or with things similar in the real world`;

  const result = await model.generateContent([prompt, ...interleavedContent]);
  const rawOutput = result.response.text()
  return rawOutput;
}

export const generateTopics = async (classId: string, className: string, summaries: string[], currentMap: MapNode | null): Promise<{ title: string, content: string, mapParent: string | null, mapId: string, lectures: string[] }[] | undefined> => {
  // in any case, we will have to apply the same algorithm to parse out the topics from the summary.
  // if we are just adding new ones, than we should extract this at the final step
  interface Node {
    id?: string;
    keyword: string;
    description: string;
    children: Node[];
    lectures: string[];
  }

  function convertMapNodeToNode(mapNode: MapNode): Node {
    return {
      id: mapNode.id,
      keyword: mapNode.keyword,
      description: mapNode.description || "",
      lectures: mapNode.lectures || [],
      children: mapNode.children?.map(convertMapNodeToNode) || [],
    };
  }
  const currentMapNode: Node | null = currentMap ? convertMapNodeToNode(currentMap) : null;
  const currentTopics: string = currentMap ? JSON.stringify(currentMapNode) : "";

  const content = summaries.join("\n");
  const systemPrompt = 'You are an educational assistant that generates a mindmap to help a student gain a visual understanding of the course: ' + className + '. Your task is to\n' +
    '1. The primary topic, which will branch out into all other nodes is: ' + className + '\n' +
    '2. Find the central lecture topic(s), which are enclosed in the <START: Lecture Name | Lecture ID> and <END> tags. These will branch out from the primary topic\n' +
    '3. come up with 2 related terminologies, keywords, or concepts that branches out for each central topic. E.g. if there is only one central lecture topic you find in tags, then only make 2 bracnhes.\n' +
    '4. Add the realted lectures (ids) for each of the topics. The central topic should have all of the lectures found in the content. If one of the topics is itself a lecture, you can add its own id to "lectures". It is possible that some topics may have lectures that are a part of another branch. It is not possible for a topic to have no lectures. \n' +
    'After coming up with the related words, repeat the same process for each of the words, so it keeps branching out. Here are the rules you must keep.\n' +
    '\n' +
    '-You MUST only output your result in a nested JSON format with keys "keyword", "description", and "children".\n' +
    '-Do not add anything else to the output.\n' +
    'An example is given below (for the course: Calculus) to help your understanding. In the example below, the content of most descriptions were abbreviated for the sake of space but you must give a one-sentence definition for the keywords for all keywords in the actual output. Only output your result like the given example delimited inside ### but DO NOT INCLUDE THE DELIMITER IN YOUR OUTPUT.\n' +
    'Example>\n' +
    'OUTPUT:\n' +
    '###\n' +
    '{"keyword":"Calculus","description":"Calculus is a branch of mathematics that studies continuous change, primarily through derivatives and integrals.", "lectures":["518c8677-5681-492b-b61d-34439ac87af2"],\n' +
    '"children":[{"keyword":"Differential Calculus","description":"Differential Calculus focuses on the concept of a derivative, which represents an instantaneous rate of change.",\n' +
    '"lectures":["518c8677-5681-492b-b61d-34439ac87af2", "5ff75655-f3ec-4119-ad38-ceb9eebedc8f"],\n' +
    '"children":[{"keyword":"Limits","description":"..."},\n' +
    '{"keyword":"Derivatives","description":"...",\n' +
    '"children":[{"keyword":"Chain Rule","description":"..."},\n' +
    '{"keyword":"Implicit Differentiation","description":"..."},\n' +
    '{"keyword":"Partial Differentiation","description":"..."}]},\n' +
    '{"keyword":"Applications of Derivatives","description":"...",\n' +
    '"children":[{"keyword":"Optimization","description":"..."},\n' +
    '{"keyword":"Related Rates","description":"..."},\n' +
    '{"keyword":"Tangent Lines","description":"..."},\n' +
    '{"keyword":"L Hôpitals Rule","description":"..."}]}]},\n' +
    '{"keyword":"Integral Calculus","description":"...",\n' +
    '"children":[{"keyword":"Antiderivatives","description":"..."},\n' +
    '{"keyword":"Definite Integrals","description":"...",\n' +
    '"children":[{"keyword":"Fundamental Theorem of Calculus","description":"..."},\n' +
    '{"keyword":"Area between Curves","description":"..."}]},\n' +
    '{"keyword":"Applications of Integrals","description":"...",\n' +
    '"children":[{"keyword":"Area under Curves","description":"..."},\n' +
    '{"keyword":"Volume of Solids","description":"..."},\n' +
    '{"keyword":"Work and Accumulation","description":"..."},\n' +
    '{"keyword":"Arc Length","description":"..."}]}]},\n' +
    '{"keyword":"Multivariable Calculus","description":"...",\n' +
    '"children":[{"keyword":"Partial Derivatives","description":"..."},\n' +
    '{"keyword":"Multiple Integrals","description":"...",\n' +
    '"children":[{"keyword":"Double Integrals","description":"..."},\n' +
    '{"keyword":"Triple Integrals","description":"..."}]},\n' +
    '{"keyword":"Vector Calculus","description":"...",\n' +
    '"children":[{"keyword":"Gradient","description":"..."},\n' +
    '{"keyword":"Divergence","description":"..."},\n' +
    '{"keyword":"Curl","description":"..."},\n' +
    '{"keyword":"Stokes Theorem","description":"..."},\n' +
    '{"keyword":"Greens Theorem","description":"..."}]}]},\n' +
    '{"keyword":"Sequences and Series","description":"...",\n' +
    '"children":[{"keyword":"Convergence and Divergence","description":"..."},\n' +
    '{"keyword":"Taylor Series","description":"..."},\n' +
    '{"keyword":"Power Series","description":"..."}]},\n' +
    '{"keyword":"Differential Equations","description":"...",\n' +
    '"children":[{"keyword":"First-Order Differential Equations","description":"..."},\n' +
    '{"keyword":"Second-Order Differential Equations","description":"..."},\n' +
    '{"keyword":"Systems of Differential Equations","description":"..."},\n' +
    '{"keyword":"Boundary Value Problems","description":"..."}]}]}\n' +
    '###\n';

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-8b",
    systemInstruction: systemPrompt,
  });

  const prompt = 'Here is the lecture content for ' + className + ':' + content + '\n' +
    "Additionally, here is the current map that you can build upon. If it is empty, this means you should construct it from scratch. CURRENT MAP: \n" + currentTopics +
    "YOUR OUTPUT: "

  const result = await model.generateContent([prompt]);
  const rawOutput = result.response.text()

  // Cleaning the output
  const cleaned = rawOutput.slice(7, -4); // Removing specific characters
  const output = JSON.parse(cleaned) as Node; // Parsing JSON

  interface FlatNode {
    map_id: string;
    map_parent: string | null;
    title: string;
    content: string;
    class: string;
    lectures: string[];
  }

  function flattenTree(
    node: Node,
    parentId: string | null = null,
    flatList: FlatNode[] = []
  ): FlatNode[] {
    const mapId = uuidv4();
    const nodeDict: FlatNode = {
      map_id: node.id ?? mapId,
      map_parent: parentId,
      title: node.keyword,
      content: node.description,
      class: classId,
      lectures: node.lectures || [],
    };

    flatList.push(nodeDict);

    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        flattenTree(child, mapId, flatList);
      });
    }

    return flatList;
  }

  const flatList = flattenTree(output);
  if (currentMapNode) {
    const originalFlatList = flattenTree(currentMapNode);
    const newTopics = flatList.filter((node) => {
      return !originalFlatList.some((originalNode) => originalNode.map_id === node.map_id);
    });
    return newTopics.map((node) => {
      return {
        title: node.title,
        content: node.content,
        mapParent: node.map_parent,
        mapId: node.map_id,
        lectures: node.lectures,
      };
    });
  } else {
    return flatList.map((node) => {
      return {
        title: node.title,
        content: node.content,
        mapParent: node.map_parent,
        mapId: node.map_id,
        lectures: node.lectures,
      };
    });
  }
}

export const storeSlideDocuments = async (slideId: string, textSummaries: string[]) => {
  // use langchain to get embeddings for the slides, should auto store in database
  const vectorStore = new SupabaseVectorStore(embeddings, {
    client: supabase,
    tableName: "documents",
    queryName: "match_documents",
  });

  const documents: Document[] = textSummaries.map((summary, index) => {
    return {
      pageContent: summary,
      metadata: {
        id: slideId,
        interval: index + 1,
        type: "slide",
      },
    };
  })

  await vectorStore.addDocuments(documents);
  return { success: true, error: "" };
}

export const generateSlideQuestions = async (className: string, textSummaries: string[], imgPaths: string[]): Promise<{
  questions: { question: string, solution: string }[]
} | undefined> => {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-8b",
    systemInstruction: `You are a teaching assistant for the course: ${className}. Your task is to generate practice questions based on the content provided. The questions should be challenging and test the student's understanding of the material.` +
    "Seperate your questions in <QUESTION> and <SOLUTION> tags. For example, <QUESTION>What is the definition of a derivative?</QUESTION><SOLUTION>The derivative of a function is the rate at which the function is changing at a given point.</SOLUTION>",
  });

  const images = await Promise.all(imgPaths.map(async (url) => {
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

  const interleavedContent = textSummaries.flatMap((textSummary, index) => {
    return [(`Page ${index + 1}: ${textSummary}`), images[index]];
  });

  const prompt = `Generate 3 practice questions with the corresponding solutions based on the following content: ${className}`;
  const result = await model.generateContent([prompt, ...interleavedContent]);
  const rawOutput = result.response.text()
  console.log(rawOutput);

  const questions = rawOutput.split("<QUESTION>").slice(1);
  const questionsList = questions.map((question) => {
    const split = question.split("<SOLUTION>");
    const formattedQuestion = split[0].replace("</QUESTION>", "").trim();
    const formattedSolution = split[1].replace("</SOLUTION>", "").trim();
    return {
      question: formattedQuestion,
      solution: formattedSolution,
    }
  });
  return {questions: questionsList};
}


export const generatePracticeExam = async (className: string, textSummaries: string[][], imgPaths: string[][]): Promise<{
  questions: { question: string, solution: string }[]
} | undefined> => {
  return { questions: [
    {question: "What is the definition of a derivative?", solution: "The derivative of a function is the rate at which the function is changing at a given point."},
    {question: "What is the definition of an integral?", solution: "The integral of a function is the area under the curve of the function."},
    {question: "What is the chain rule?", solution: "The chain rule is a formula for computing the derivative of the composition of two or more functions."},
  ]}
}


