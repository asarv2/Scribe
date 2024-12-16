/**
 * app/utils/services/summary/slide.ts
 * Used to generate a summary of a slide, with extensive unit testing.
 * @AshokSaravanan222
 * 11/20/2024
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey as string);

export const generateKeyConcepts = async (className: string, slideName: string) => {
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-8b",
        systemInstruction:
            `You have knowledge upto the PhD level in ${className}. Your task will be to generate the three most important key concepts for the following lecture notes for ${slideName}. Your output should be in markdown format. Here is an example of what the output should look like:
            ## Key Concepts
            - **Concept 1**: Definition of Concept 1
            - **Concept 2**: Definition of Concept 2
            - **Concept 3**: Definition of Concept 3`,
    });
    const response = await model.generateContent(
        `Generate 3 key concepts for the class.`,
    );
    return response.response.text();
};

export const testKeyConcepts = (content: string, keyConcepts: string[]) => {
    /**
     * Expecting an LLM to output markdown format with all the key concepts.
     * EXAMPLE:
     * ## Key Concepts
     * - **Concept 1**: Definition of Concept 1
     * - **Concept 2**: Definition of Concept 2
     * - **Concept 3**: Definition of Concept 3
     */
    const generatedKeyConcepts = content.split("## Key Concepts")[1];
    const generatedKeyConceptsArray = generatedKeyConcepts.split("- **").map((
        concept,
    ) => concept.replace("**", "").trim());
    const keyConceptsSet = new Set(keyConcepts);
    const generatedKeyConceptsSet = new Set(generatedKeyConceptsArray);
    return keyConceptsSet.size === generatedKeyConceptsSet.size &&
        Array.from(keyConceptsSet).every((concept) =>
            generatedKeyConceptsSet.has(concept)
        );
};

export const testKeyProblems = (content: string, keyProblems: string[]) => {
    /**
     * Expecting an LLM to output markdown format with all the key problems.
     * EXAMPLE:
     * ## Key Problems
     * - **Problem 1**: Definition of Problem 1
     * - **Problem 2**: Definition of Problem 2
     * - **Problem 3**: Definition of Problem 3
     */
    const generatedKeyProblems = content.split("## Key Problems")[1];
    const generatedKeyProblemsArray = generatedKeyProblems.split("- **").map((
        problem,
    ) => problem.replace("**", "").trim());
    const keyProblemsSet = new Set(keyProblems);
    const generatedKeyProblemsSet = new Set(generatedKeyProblemsArray);
    return keyProblemsSet.size === generatedKeyProblemsSet.size &&
        Array.from(keyProblemsSet).every((problem) =>
            generatedKeyProblemsSet.has(problem)
        );
};

export const testKeyAlgorithmSolutions = (
    content: string,
    keyAlgorithmSolutions: string[],
) => {
    /**
     * Expecting an LLM to output markdown format with all the key algorithm solutions.
     * EXAMPLE:
     * ## Key Algorithm Solutions
     * - **Solution 1**: Definition of Solution 1
     * - **Solution 2**: Definition of Solution 2
     * - **Solution 3**: Definition of Solution 3
     */
    const generatedKeyAlgorithmSolutions =
        content.split("## Key Algorithm Solutions")[1];
    const generatedKeyAlgorithmSolutionsArray = generatedKeyAlgorithmSolutions
        .split("- **").map((solution) => solution.replace("**", "").trim());
    const keyAlgorithmSolutionsSet = new Set(keyAlgorithmSolutions);
    const generatedKeyAlgorithmSolutionsSet = new Set(
        generatedKeyAlgorithmSolutionsArray,
    );
    return keyAlgorithmSolutionsSet.size ===
            generatedKeyAlgorithmSolutionsSet.size &&
        Array.from(keyAlgorithmSolutionsSet).every((solution) =>
            generatedKeyAlgorithmSolutionsSet.has(solution)
        );
};
