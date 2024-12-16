/**
 * app/utils/services/parsing/notes.ts
 * Used to parse notes from lecture slides, so it can be used later to generate summaries.
 * @AshokSaravanan222
 * 11/20/2024
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey as string);


export const parseNotes = async (className: string) => {
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-8b",
        systemInstruction:
            `You are an expert in parsing notes from lecture slides. Your task is to extract as much information as possible from the page you see. Keep all of the structural content, including the equations, graphs, and other visual content.`,
    });
    const response = await model.generateContent(
        "Extract all of the notes from the slide.",
    );

    return response.response.text()
};