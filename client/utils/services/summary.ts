/**
 * utils/services/summary.ts
 * Will handle generating summaries for each lecture.
 */
import { fromBuffer } from 'pdf2pic';

// Import or initialize your LLM client here. For example:
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { cookies } from 'next/headers';
import useSupabaseServer from '../supabase/supabase-server';
import { BaseMessage, BaseMessageLike } from '@langchain/core/messages';

export const generateSummary = async (slideId: string, textSummaries: string[], formData: FormData): Promise<string> => {
    const supabase = useSupabaseServer(cookies());
    // Get the PDF file from FormData
    const file = formData.get('document') as File;
    if (!file) {
        throw new Error('No file provided');
    }

    // Read the file into a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Initialize pdf2pic for converting PDF pages to images
    const pdf2pic = fromBuffer(buffer, {
        density: 300,
        format: 'png',
        width: 800,
        height: 1200,
    });

    // Load the PDF document

    const allContent = await Promise.all(textSummaries.map(async (textSummary, pageNum) => {
        // Convert the page to an image and get base64 data
        const pageImage = await pdf2pic(pageNum + 1, { responseType: "base64" }); // `true` returns image as base64
        const img_base64 = pageImage.base64;

        // Create content for this page
        const pageContent = [
            {
                role: 'document',
                type: 'image_url',
                image_url: {
                    url: `data:image/png;base64,${img_base64}`,
                    mime_type: 'image/png',
                },
                content: textSummary,
            },
        ];
        return pageContent;
    }))

    const flatAllContent: BaseMessageLike[] = allContent.flat();

    // Add the analysis prompt to the content
    const analysisPrompt = `Please provide a thorough analysis of this document, including both text and visual elements. Focus on:
        1. Main concepts and ideas from the text
        2. Description and interpretation of any diagrams, charts, or visual elements
        3. How the visual elements support or illustrate the text content
        4. Any important symbols, notations, or visual patterns and their meanings
        5. The overall relationship between textual and visual information
        6. Include easy to understand definitions of key terms
        7. If possible include easy to understand examples of this being applied in the world, or with things similar in the real world`;

    const analysisContent = {
        type: 'text',
        content: analysisPrompt,
    } as BaseMessageLike;

    const content: BaseMessageLike[] = [...flatAllContent, analysisContent]

    // Initialize the LLM client (adjust this part according to your LLM API)
    // For example, using ChatGoogleGenerativeAI:

    const llm = new ChatGoogleGenerativeAI({
        model: 'gemini-1.5-flash-8b',
        temperature: 0,
        maxRetries: 2,
    });

    // Get response from the LLM
    const rawResponse = await llm.invoke([...content]);
    console.log(rawResponse);
    const response = String(rawResponse.content[0])

    const { data, error } = await supabase
        .from('summaries')
        .insert({ content: response, slide: slideId });

    if (error) {
        throw new Error('Failed to save summary');
    }

    return response
};
