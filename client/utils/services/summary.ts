/**
 * utils/services/summary.ts
 * Will handle generating summaries for each lecture.
 */


// export const generateSummary = async (document: string): Promise<string> => {
//     // Create a retriever
//     try {
//         // Create the RetrievalQA chain
//         const prompt = ChatPromptTemplate.fromTemplate(`Summarize the following document: {input}`);
//         const combineDocsChain = await createStuffDocumentsChain({
//             llm,
//             prompt,
//             retriever,
//         });

//         // Generate the summary
//         const summary = await combineDocsChain.generate(document);
//         return summary;
//     } catch (error) {
//         throw new Error(`Error generating summary: ${error}`);
//     }
// }