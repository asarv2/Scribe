/**
 * utils/services/question.ts
 * Will handle a user asking a question in the app.
 */
"use server"
import OpenAI from "openai";

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