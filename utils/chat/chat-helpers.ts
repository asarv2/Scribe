/**
 * Calculate text similarity between two strings based on shared words
 * @param text1 First text to compare
 * @param text2 Second text to compare
 * @returns Similarity score between 0 and 1
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  // Normalize and split text into words
  const words1 = text1.toLowerCase().split(/\W+/).filter(word => word.length > 2);
  const words2 = text2.toLowerCase().split(/\W+/).filter(word => word.length > 2);
  
  // Create sets for unique words
  const uniqueWords1 = new Set(words1);
  const uniqueWords2 = new Set(words2);
  
  // Count matching words
  let matchCount = 0;
  uniqueWords1.forEach(word => {
    if (uniqueWords2.has(word)) matchCount++;
  });
  
  // Calculate similarity score
  const totalUniqueWords = new Set([...uniqueWords1, ...uniqueWords2]).size;
  return totalUniqueWords > 0 ? matchCount / totalUniqueWords : 0;
}

/**
 * Find relevant context based on text similarity
 * @param question User's question
 * @param lectures Available lectures
 * @param chapters Available chapters 
 * @param homeworks Available homeworks
 * @param similarityThreshold Minimum similarity score to consider (0-1)
 * @returns Object containing relevant lecture, chapter and homework IDs
 */
export function findRelevantContextByQuestion(
  question: string,
  lectures: any[],
  chapters: any[],
  homeworks: any[],
  similarityThreshold = 0.15,
  maxMatches = 2
) {
  const relevantContext = {
    lectures: [] as string[],
    chapters: [] as string[],
    homeworks: [] as string[]
  };
  
  // Find matching lectures
  if (lectures && lectures.length) {
    const lectureMatches = lectures
      .map(lecture => ({
        id: lecture.id,
        similarity: calculateTextSimilarity(question, lecture.name || '')
      }))
      .filter(match => match.similarity > similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxMatches);
    
    relevantContext.lectures = lectureMatches.map(match => match.id);
  }
  
  // Find matching chapters
  if (chapters && chapters.length) {
    const chapterMatches = chapters
      .map(chapter => ({
        id: chapter.id,
        similarity: calculateTextSimilarity(question, chapter.title || '')
      }))
      .filter(match => match.similarity > similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxMatches);
    
    relevantContext.chapters = chapterMatches.map(match => match.id);
  }
  
  // Find matching homeworks
  if (homeworks && homeworks.length) {
    const homeworkMatches = homeworks
      .map(homework => ({
        id: homework.id,
        similarity: calculateTextSimilarity(question, homework.title || '')
      }))
      .filter(match => match.similarity > similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxMatches);
    
    relevantContext.homeworks = homeworkMatches.map(match => match.id);
  }
  
  return relevantContext;
}