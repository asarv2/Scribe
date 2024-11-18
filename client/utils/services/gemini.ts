/**
 * utils/services/gemini.ts
 * Will handle a user asking questions to gemini.
 */
"use server";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";
import { BaseMessage, BaseMessageLike } from "@langchain/core/messages";
import { Slide, SlideData, Summary, Topic } from "@/types";
import { MapNode } from "../map/map-tree";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";
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

export const answerQuestion = async (
  question: string,
): Promise<{ response: string; documents: string[] }> => {
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
    const prompt = ChatPromptTemplate.fromTemplate(
      `Answer the user's question: {input} based on the following context {context}`,
    );

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
    const langchainDocs = response.context;
    console.log(langchainDocs);
    const documents = langchainDocs.map((doc) => doc.metadata.document_id)
      .filter((doc) => doc !== undefined);
    // Return the generated answer
    return { response: response.answer, documents: documents };
  } catch (error) {
    console.error(error);
    throw new Error("Failed to answer question");
  }
};

export const findRelevantNoteDocuments = async (
  question: string,
): Promise<string[]> => {
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
  const langchainDocs = await retriever.invoke(question);
  console.log(langchainDocs);
  const documents = langchainDocs.map((doc) => doc.metadata.document_id).filter(
    (doc) => doc !== undefined
  );
  return documents;
};

export const answerSlideQuestion = async (
  question: string,
  context: string,
  imageUrls: string[],
): Promise<{ response: string }> => {
  // prompting gemini with all information
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-8b",
      systemInstruction:
        "You the teacher of the class: , teaching the following lecture on the topic: . Students will ask questions about the lecture content, which will be provided below. You emphasize teaching the theory and how the content works, rather than providing a solution, since you do not know the extent of the student's knowledge. Be sure to respond with an answer that is clear and concise, while still being through.",
    });

    const images = await Promise.all(imageUrls.map(async (url) => {
      const response = await fetch(url);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64String = Buffer.from(arrayBuffer).toString("base64");
      return {
        inlineData: {
          data: base64String,
          mimeType: "image/png",
        },
      };
    }));

    const prompt = "Answer the student's question: " + question +
      " based on the following context: " + context;
    const result = await model.generateContent([prompt, ...images]);
    const rawOutput = result.response.text();
    return { response: rawOutput };
  } catch (error) {
    console.error(error);
    return { response: "Could not answer question" };
  }
};

export const answerTextbookQuestion = async (
  question: string,
): Promise<{ response: string; documents: string[] }> => {
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
    const prompt = ChatPromptTemplate.fromTemplate(
      `Answer the user's question: {input} based on the following context {context}`,
    );

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
    const langchainDocs = response.context;
    console.log(langchainDocs);
    const documents = langchainDocs.map((doc) => doc.metadata.document_id)
      .filter((doc) => doc !== undefined);
    // Return the generated answer
    return { response: response.answer, documents: documents };
  } catch (error) {
    console.error(error);
    throw new Error("Failed to answer question");
  }
};

export const generateSummary = async (
  className: string,
  textSummaries: string[],
  imgPaths: string[],
): Promise<string | undefined> => {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-8b",
    systemInstruction:
      `You are an deep expert in: ${className}, with knowledge upto the PhD level.`,
  });

  const images = await Promise.all(imgPaths.map(async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64String = Buffer.from(arrayBuffer).toString("base64");
    return {
      inlineData: {
        data: base64String,
        mimeType: "image/png",
      },
    };
  }));

  const interleavedContent = textSummaries.flatMap((textSummary, index) => {
    return [`Page ${index + 1}: ${textSummary}`, images[index]];
  });

  const prompt =
    `Please provide a thorough analysis of this document, including both text and visual elements. Focus on:
        1. Main concepts and ideas from the text
        2. Description and interpretation of any diagrams, charts, or visual elements
        3. How the visual elements support or illustrate the text content
        4. Any important symbols, notations, or visual patterns and their meanings
        5. The overall relationship between textual and visual information
        6. Include easy to understand definitions of key terms
        7. If possible include easy to understand examples of this being applied in the world, or with things similar in the real world`;
  const result = await model.generateContent([prompt, ...interleavedContent]);
  const rawOutput = result.response.text();
  return rawOutput;
};

export const regenerateSummary = async (
  classId: string,
  className: string,
  documents: SlideData[],
  previousSummaries: Summary[],
): Promise<string | null> => {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-8b",
    systemInstruction:
      `You are an deep expert in: ${className}, with knowledge upto the PhD level.`,
  });

  const images = await Promise.all(documents.map(async (document) => {
    const img_url =
      `https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/lectures/${classId}/${document.slide}/page_${document.page}.png`;
    const response = await fetch(img_url);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64String = Buffer.from(arrayBuffer).toString("base64");
    return {
      inlineData: {
        data: base64String,
        mimeType: "image/png",
      },
    };
  }));

  const interleavedContent = documents.flatMap((document, index) => {
    return [`Page ${index + 1}: ${document.content}`, images[index]];
  });

  const lastSummary = previousSummaries[previousSummaries.length - 1];
  const prompt =
    `Regenerate the follwing prompt, but take a different approach to what your response was last time. LAST RESPONSE: ${lastSummary}. YOUR PROMPT: Please provide a thorough analysis of this document, including both text and visual elements. Focus on:
        1. Main concepts and ideas from the text
        2. Description and interpretation of any diagrams, charts, or visual elements
        3. How the visual elements support or illustrate the text content
        4. Any important symbols, notations, or visual patterns and their meanings
        5. The overall relationship between textual and visual information
        6. Include easy to understand definitions of key terms
        7. If possible include easy to understand examples of this being applied in the world, or with things similar in the real world`;

  const result = await model.generateContent([prompt, ...interleavedContent]);
  const rawOutput = result.response.text();
  return rawOutput;
};

export const generateTopics = async (
  classId: string,
  className: string,
  summaries: string[],
  currentMap: MapNode | null,
): Promise<
  {
    title: string;
    content: string;
    mapParent: string | null;
    mapId: string;
    lectures: string[];
    newNode: boolean;
  }[] | undefined
> => {
  interface Node {
    keyword: string;
    description: string;
    children: Node[];
    lectures: string[];
  }

  function convertMapNodeToNode(mapNode: MapNode): Node {
    return {
      keyword: mapNode.keyword,
      description: mapNode.description || "",
      lectures: mapNode.lectures || [],
      children: mapNode.children?.map(convertMapNodeToNode) || [],
    };
  }

  const content = summaries.join("\n");
  const systemPrompt =
    `You are an educational assistant that generates mindmaps to help students visually understand ${className}.

  TASK:
  Generate a hierarchical knowledge map following these requirements:

  1. Root Node
  - Primary topic must be: "${className}"
  - This will be the root that all other nodes branch from

  2. Structure
  - Parse lecture topics from content marked with <START: Lecture Name | Lecture ID> and <END> tags
  - These become first-level branches from the root
  - Generate exactly 2 related subtopics/concepts for each lecture topic
  - Subtopics should be key terminology or fundamental concepts
  - THE MAXIMUM DEPTH OF THE TREE IS 2, DO NOT BREAK THIS RULE

  3. Lecture References
  - Root node should include ALL lecture IDs found in content
  - Lecture topics should reference their own ID
  - Subtopics may have 0 or more relevant lecture IDs

  4. Output Format
  - Must be valid JSON with these keys for each node:
    - "keyword": Topic name
    - "description": One clear, concise definitional sentence
    - "children": Array of child nodes
    - "lectures": Array of relevant lecture IDs
  - No additional text or formatting

  Here are two example inputs and their expected outputs:

  Example 1:
  INPUT:
  Course: Calculus
  <START: Limits | 123e4567-e89b-12d3-a456-426614174000> and <END>

  OUTPUT:
  {
    "keyword": "Calculus",
    "description": "Calculus is a branch of mathematics that studies continuous change, primarily through derivatives and integrals.",
    "lectures": ["123e4567-e89b-12d3-a456-426614174000"],
    "children": [
      {
        "keyword": "Limits",
        "description": "Limits describe the value that a function approaches as the input approaches a specified point.",
        "lectures": ["123e4567-e89b-12d3-a456-426614174000"],
        "children": [
          {
            "keyword": "One-Sided Limits",
            "description": "One-sided limits evaluate the behavior of a function as it approaches a specific point from one direction (left or right).",
            "lectures": ["123e4567-e89b-12d3-a456-426614174000"]
          },
          {
            "keyword": "Limit Laws",
            "description": "Limit laws are rules and properties used to evaluate the limits of functions systematically.",
            "lectures": ["123e4567-e89b-12d3-a456-426614174000"]
          }
        ]
      }
    ]
  }

  Focus on:
  - Clear, educational definitions
  - Logical hierarchical relationships
  - Accurate lecture ID references
  - Valid JSON structure`;

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-8b",
    systemInstruction: systemPrompt,
  });

  const prompt = "Here is the lecture content for " + className + ":" +
    content + "\n" +
    "YOUR OUTPUT: ";

  const result = await model.generateContent([prompt]);
  const rawOutput = result.response.text();

  // Cleaning the output
  const cleaned = rawOutput.slice(7, -4);
  let output = JSON.parse(cleaned) as Node;

  // Track existing node keywords for determining what's new
  const existingNodeKeywords = new Set<string>();
  if (currentMap) {
    const collectKeywords = (node: MapNode) => {
      existingNodeKeywords.add(node.keyword);
      node.children?.forEach(collectKeywords);
    };
    collectKeywords(currentMap);
  }

  // If there's an existing map, merge the new content with it
  if (currentMap) {
    const existingNode = convertMapNodeToNode(currentMap);

    // Merge lectures arrays from new output into existing root node
    existingNode.lectures = Array.from(new Set([...existingNode.lectures, ...output.lectures]));

    // Add new children to existing map while preserving current ones
    output.children.forEach((newChild) => {
      const existingChild = existingNode.children.find(child => child.keyword === newChild.keyword);
      if (existingChild) {
        // Merge lectures if the topic already exists
        existingChild.lectures = Array.from(new Set([...existingChild.lectures, ...newChild.lectures]));
        // Merge children while preserving existing ones
        newChild.children.forEach(newGrandchild => {
          if (!existingChild.children.some(child => child.keyword === newGrandchild.keyword)) {
            existingChild.children.push(newGrandchild);
          }
        });
      } else {
        // Add new topic if it doesn't exist
        existingNode.children.push(newChild);
      }
    });

    output = existingNode;
  }

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
    flatList: FlatNode[] = [],
  ): FlatNode[] {
    const mapId = currentMap && !parentId ? currentMap.id : uuidv4();
    const nodeDict: FlatNode = {
      map_id: mapId,
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
  return flatList.map((node) => {
    // A node is new if:
    // 1. There is no existing map, or
    // 2. The node's keyword wasn't in the existing map (except for the root node when there is an existing map)
    const isNewNode = !currentMap || 
      (!existingNodeKeywords.has(node.title) && !(currentMap && node.map_parent === null));

    return {
      title: node.title,
      content: node.content,
      mapParent: node.map_parent,
      mapId: node.map_id,
      lectures: node.lectures,
      newNode: isNewNode,
    };
  });
};

export const storeSlideDocuments = async (
  slideId: string,
  textSummaries: string[],
) => {
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
  });

  await vectorStore.addDocuments(documents);
  return { success: true, error: "" };
};

export const generateSlideQuestions = async (
  className: string,
  textSummaries: string[],
  imgPaths: string[],
): Promise<
  {
    questions: { question: string; solution: string }[];
  } | undefined
> => {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-8b",
    systemInstruction:
      `You are a teaching assistant for the course: ${className}. Your task is to generate practice questions based on the content provided. The questions should be challenging and test the student's understanding of the material.` +
      "Seperate your questions in <QUESTION> and <SOLUTION> tags. For example, <QUESTION>What is the definition of a derivative?</QUESTION><SOLUTION>The derivative of a function is the rate at which the function is changing at a given point.</SOLUTION>. When writing mathematical equations, use LaTeX format.",
  });

  const images = await Promise.all(imgPaths.map(async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64String = Buffer.from(arrayBuffer).toString("base64");
    return {
      inlineData: {
        data: base64String,
        mimeType: "image/png",
      },
    };
  }));

  const interleavedContent = textSummaries.flatMap((textSummary, index) => {
    return [`Page ${index + 1}: ${textSummary}`, images[index]];
  });

  const prompt =
    `Generate 3 practice questions with the corresponding solutions based on the following content: ${className}`;
  const result = await model.generateContent([prompt, ...interleavedContent]);
  const rawOutput = result.response.text();
  console.log(rawOutput);

  const questions = rawOutput.split("<QUESTION>").slice(1);
  const questionsList = questions.map((question) => {
    const split = question.split("<SOLUTION>");
    const formattedQuestion = split[0].replace("</QUESTION>", "").trim();
    const formattedSolution = split[1].replace("</SOLUTION>", "").trim();
    return {
      question: formattedQuestion,
      solution: formattedSolution,
    };
  });
  return { questions: questionsList };
};

export const generatePracticeExam = async (
  className: string,
  textSummaries: string[][],
  imgPaths: string[][],
): Promise<
  {
    questions: { question: string; solution: string }[];
  } | undefined
> => {
  return {
    questions: [
      {
        question: "What is the definition of a derivative?",
        solution:
          "The derivative of a function is the rate at which the function is changing at a given point.",
      },
      {
        question: "What is the definition of an integral?",
        solution:
          "The integral of a function is the area under the curve of the function.",
      },
      {
        question: "What is the chain rule?",
        solution:
          "The chain rule is a formula for computing the derivative of the composition of two or more functions.",
      },
    ],
  };
};

export const regeneratePracticeExam = async (
  className: string,
  textSummaries: string[][],
  imgPaths: string[][],
  pastQuestions: { question: string; solution: string }[],
): Promise<
  {
    questions: { question: string; solution: string }[];
  } | undefined
> => {
  return {
    questions: [
      {
        question: "What is the definition of a derivative?",
        solution:
          "The derivative of a function is the rate at which the function is changing at a given point.",
      },
    ],
  };
};
