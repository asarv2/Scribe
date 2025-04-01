import { Chapter, Document, Exercise, Homework, Lecture, Textbook, ViewerMode } from "@/types";
import { Dispatch, SetStateAction } from "react";

// Filter out code blocks from text but preserve text content
export const filterCodeBlocks = (text: string): string => {
    if (!text) return '';

    let result = text;
    
    // Replace complete <FIGURE> tags with placeholders
    result = result.replace(/<FIGURE>[\s\S]*?<\/FIGURE>/g, '<FIGURE_GENERATION>figure-placeholder</FIGURE_GENERATION>');
    
    // Replace complete <SUMMARY> tags with placeholders
    result = result.replace(/<SUMMARY>[\s\S]*?<\/SUMMARY>/g, '<SUMMARY_GENERATION>summary-placeholder</SUMMARY_GENERATION>');
    
    // Replace complete <QUESTION> tags with placeholders
    result = result.replace(/<QUESTION>[\s\S]*?<\/QUESTION>/g, '<QUESTION_GENERATION>question-placeholder</QUESTION_GENERATION>');
    
    // Handle incomplete tags (only opening tag present)
    // This will remove everything after the opening tag to the end of the text
    result = result.replace(/<FIGURE>[\s\S]*$/, '<FIGURE_GENERATION>figure-placeholder</FIGURE_GENERATION>');
    result = result.replace(/<SUMMARY>[\s\S]*$/, '<SUMMARY_GENERATION>summary-placeholder</SUMMARY_GENERATION>');
    result = result.replace(/<QUESTION>[\s\S]*$/, '<QUESTION_GENERATION>question-placeholder</QUESTION_GENERATION>');
    
    return result;
};

// Split text by document references and preserve formatting
export const splitTextByDocuments = (text: string, lectureDocuments: Document[],
    chapterDocuments: Document[],
    fileDocuments: Document[],
    chapterExercises: Exercise[],
    homeworkExercises: Exercise[]): string => {

    const documentTags: Array<{id: string, type: 'lecture' | 'chapter' | 'file'}> = [];
    const exerciseTags: Array<{id: string, type: 'chapter_exercise' | 'homework_problem'}> = [];
    let cleanedText = text;

    // Extract all document tags and store them with their types
    const documentPatterns = [
        { regex: /<DOCUMENT_LECTURE>([^<]+)<\/DOCUMENT_LECTURE>/g, type: 'lecture', tagFormat: 'lecture' },
        { regex: /<DOCUMENT_CHAPTER>([^<]+)<\/DOCUMENT_CHAPTER>/g, type: 'chapter', tagFormat: 'chapter' },
        { regex: /<DOCUMENT_FILE>([^<]+)<\/DOCUMENT_FILE>/g, type: 'file', tagFormat: 'file' }
    ];

    const exercisePatterns = [
        { regex: /<EXERCISE_CHAPTER>([^<]+)<\/EXERCISE_CHAPTER>/g, type: 'chapter_exercise', tagFormat: 'exercise' },
        { regex: /<PROBLEM_HOMEWORK>([^<]+)<\/PROBLEM_HOMEWORK>/g, type: 'homework_problem', tagFormat: 'problem' }
    ];

    // Find consecutive document tags followed by a period
    const consecutiveDocTagsWithPeriod = /((?:<DOCUMENT_[A-Z]+>[^<]+<\/DOCUMENT_[A-Z]+>\s*)+)\./g;
    let match;
    while ((match = consecutiveDocTagsWithPeriod.exec(text)) !== null) {
        const tagGroup = match[1];
        const fullMatch = match[0];
        
        // Group tags by their type and parent attribute
        const groupedTags: Record<string, Record<string, string[]>> = {};
        
        // Process each document tag in the group
        documentPatterns.forEach(pattern => {
            const tagRegex = new RegExp(pattern.regex.source, 'g');
            let tagMatch;
            while ((tagMatch = tagRegex.exec(tagGroup)) !== null) {
                const id = tagMatch[1];
                documentTags.push({ id, type: pattern.type as 'lecture' | 'chapter' | 'file' });
                
                // Find the document to check its parent attribute
                let parentAttribute = '';
                if (pattern.type === 'lecture') {
                    const doc = lectureDocuments.find(d => d.id === id);
                    parentAttribute = doc?.lecture || 'unknown';
                } else if (pattern.type === 'chapter') {
                    const doc = chapterDocuments.find(d => d.id === id);
                    parentAttribute = doc?.chapter || 'unknown';
                } else if (pattern.type === 'file') {
                    const doc = fileDocuments.find(d => d.id === id);
                    parentAttribute = doc?.file || 'unknown';
                }
                
                // Group by tag type and parent attribute
                if (!groupedTags[pattern.tagFormat]) {
                    groupedTags[pattern.tagFormat] = {};
                }
                if (!groupedTags[pattern.tagFormat][parentAttribute]) {
                    groupedTags[pattern.tagFormat][parentAttribute] = [];
                }
                groupedTags[pattern.tagFormat][parentAttribute].push(id);
            }
        });
        
        // Replace the entire group with period first, then grouped tags
        let replacementText = '.';
        let tagsReplacement = '';
        
        // Create combined tags for each group
        Object.entries(groupedTags).forEach(([tagFormat, parentGroups]) => {
            Object.entries(parentGroups).forEach(([_, ids]) => {
                tagsReplacement += `::${tagFormat}{id=${ids.join(',')}}`;
            });
        });
        
        // Find any text before the tag group and trim trailing whitespace
        const beforeTagIndex = text.substring(0, match.index).trimEnd();
        cleanedText = cleanedText.replace(
            text.substring(beforeTagIndex.length, match.index + fullMatch.length),
            replacementText + tagsReplacement
        );
    }

    // Find consecutive exercise tags followed by a period
    const consecutiveExTagsWithPeriod = /((?:<(?:EXERCISE_CHAPTER|PROBLEM_HOMEWORK)>[^<]+<\/(?:EXERCISE_CHAPTER|PROBLEM_HOMEWORK)>\s*)+)\./g;
    while ((match = consecutiveExTagsWithPeriod.exec(text)) !== null) {
        const tagGroup = match[1];
        const fullMatch = match[0];
        
        // Group tags by their type and parent attribute
        const groupedTags: Record<string, Record<string, string[]>> = {};
        
        // Process each exercise tag in the group
        exercisePatterns.forEach(pattern => {
            const tagRegex = new RegExp(pattern.regex.source, 'g');
            let tagMatch;
            while ((tagMatch = tagRegex.exec(tagGroup)) !== null) {
                const id = tagMatch[1];
                exerciseTags.push({ id, type: pattern.type as 'chapter_exercise' | 'homework_problem' });
                
                // Find the exercise to check its parent attribute
                let parentAttribute = '';
                if (pattern.type === 'chapter_exercise') {
                    const exercise = chapterExercises.find(e => e.id === id);
                    parentAttribute = exercise?.chapter || 'unknown';
                } else if (pattern.type === 'homework_problem') {
                    const exercise = homeworkExercises.find(e => e.id === id);
                    parentAttribute = exercise?.homework || 'unknown';
                }
                
                // Group by tag type and parent attribute
                if (!groupedTags[pattern.tagFormat]) {
                    groupedTags[pattern.tagFormat] = {};
                }
                if (!groupedTags[pattern.tagFormat][parentAttribute]) {
                    groupedTags[pattern.tagFormat][parentAttribute] = [];
                }
                groupedTags[pattern.tagFormat][parentAttribute].push(id);
            }
        });
        
        // Replace the entire group with period first, then grouped tags
        let replacementText = '.';
        let tagsReplacement = '';
        
        // Create combined tags for each group
        Object.entries(groupedTags).forEach(([tagFormat, parentGroups]) => {
            Object.entries(parentGroups).forEach(([_, ids]) => {
                tagsReplacement += `::${tagFormat}{id=${ids.join(',')}}`;
            });
        });
        
        // Find any text before the tag group and trim trailing whitespace
        const beforeTagIndex = text.substring(0, match.index).trimEnd();
        cleanedText = cleanedText.replace(
            text.substring(beforeTagIndex.length, match.index + fullMatch.length),
            replacementText + tagsReplacement
        );
    }

    // Handle document tags followed by periods (non-consecutive case)
    const docPeriodPatterns = [
        { regex: /<DOCUMENT_LECTURE>([^<]+)<\/DOCUMENT_LECTURE>\s*\./g, type: 'lecture', tagFormat: 'lecture' },
        { regex: /<DOCUMENT_CHAPTER>([^<]+)<\/DOCUMENT_CHAPTER>\s*\./g, type: 'chapter', tagFormat: 'chapter' },
        { regex: /<DOCUMENT_FILE>([^<]+)<\/DOCUMENT_FILE>\s*\./g, type: 'file', tagFormat: 'file' }
    ];

    // Handle exercise tags followed by periods (non-consecutive case)
    const exercisePeriodPatterns = [
        { regex: /<EXERCISE_CHAPTER>([^<]+)<\/EXERCISE_CHAPTER>\s*\./g, type: 'chapter_exercise', tagFormat: 'exercise' },
        { regex: /<PROBLEM_HOMEWORK>([^<]+)<\/PROBLEM_HOMEWORK>\s*\./g, type: 'homework_problem', tagFormat: 'problem' }
    ];

    // Process remaining single tags with periods
    docPeriodPatterns.forEach(pattern => {
        while ((match = pattern.regex.exec(text)) !== null) {
            // Skip if this was already handled by the consecutive tags logic
            if (consecutiveDocTagsWithPeriod.test(match[0])) continue;
            
            documentTags.push({ id: match[1], type: pattern.type as 'lecture' | 'chapter' | 'file' });
            // Move the period to the front and trim any whitespace
            const beforeTagIndex = text.substring(0, match.index).trimEnd();
            cleanedText = cleanedText.replace(
                text.substring(beforeTagIndex.length, match.index + match[0].length),
                `.::${pattern.tagFormat}{id=${match[1]}}`
            );
        }
    });

    exercisePeriodPatterns.forEach(pattern => {
        while ((match = pattern.regex.exec(text)) !== null) {
            // Skip if this was already handled by the consecutive tags logic
            if (consecutiveExTagsWithPeriod.test(match[0])) continue;
            
            exerciseTags.push({ id: match[1], type: pattern.type as 'chapter_exercise' | 'homework_problem' });
            // Move the period to the front and trim any whitespace
            const beforeTagIndex = text.substring(0, match.index).trimEnd();
            cleanedText = cleanedText.replace(
                text.substring(beforeTagIndex.length, match.index + match[0].length),
                `.::${pattern.tagFormat}{id=${match[1]}}`
            );
        }
    });

    // Then process regular tags without periods
    // Group consecutive tags of the same type
    const consecutiveDocTags = /((?:<DOCUMENT_([A-Z]+)>[^<]+<\/DOCUMENT_\2>\s*)+)/g;
    while ((match = consecutiveDocTags.exec(text)) !== null) {
        const tagGroup = match[1];
        const fullMatch = match[0];
        
        // Skip if this was already handled by the period logic
        if (tagGroup.endsWith('.')) continue;
        
        // Group tags by their type and parent attribute
        const groupedTags: Record<string, Record<string, string[]>> = {};
        
        // Process each document tag in the group
        documentPatterns.forEach(pattern => {
            const tagRegex = new RegExp(pattern.regex.source, 'g');
            let tagMatch;
            while ((tagMatch = tagRegex.exec(tagGroup)) !== null) {
                const id = tagMatch[1];
                
                // Find the document to check its parent attribute
                let parentAttribute = '';
                if (pattern.type === 'lecture') {
                    const doc = lectureDocuments.find(d => d.id === id);
                    parentAttribute = doc?.lecture || 'unknown';
                } else if (pattern.type === 'chapter') {
                    const doc = chapterDocuments.find(d => d.id === id);
                    parentAttribute = doc?.chapter || 'unknown';
                } else if (pattern.type === 'file') {
                    const doc = fileDocuments.find(d => d.id === id);
                    parentAttribute = doc?.file || 'unknown';
                }
                
                // Group by tag type and parent attribute
                if (!groupedTags[pattern.tagFormat]) {
                    groupedTags[pattern.tagFormat] = {};
                }
                if (!groupedTags[pattern.tagFormat][parentAttribute]) {
                    groupedTags[pattern.tagFormat][parentAttribute] = [];
                }
                groupedTags[pattern.tagFormat][parentAttribute].push(id);
            }
        });
        
        // Replace the entire group with grouped tags
        let tagsReplacement = '';
        
        // Create combined tags for each group
        Object.entries(groupedTags).forEach(([tagFormat, parentGroups]) => {
            Object.entries(parentGroups).forEach(([_, ids]) => {
                tagsReplacement += `::${tagFormat}{id=${ids.join(',')}}`;
            });
        });
        
        if (tagsReplacement) {
            cleanedText = cleanedText.replace(fullMatch, tagsReplacement);
        }
    }
    
    // Group consecutive exercise tags of the same type
    const consecutiveExTags = /((?:<(EXERCISE_CHAPTER|PROBLEM_HOMEWORK)>[^<]+<\/\2>\s*)+)/g;
    while ((match = consecutiveExTags.exec(text)) !== null) {
        const tagGroup = match[1];
        const fullMatch = match[0];
        
        // Skip if this was already handled by the period logic
        if (tagGroup.endsWith('.')) continue;
        
        // Group tags by their type and parent attribute
        const groupedTags: Record<string, Record<string, string[]>> = {};
        
        // Process each exercise tag in the group
        exercisePatterns.forEach(pattern => {
            const tagRegex = new RegExp(pattern.regex.source, 'g');
            let tagMatch;
            while ((tagMatch = tagRegex.exec(tagGroup)) !== null) {
                const id = tagMatch[1];
                
                // Find the exercise to check its parent attribute
                let parentAttribute = '';
                if (pattern.type === 'chapter_exercise') {
                    const exercise = chapterExercises.find(e => e.id === id);
                    parentAttribute = exercise?.chapter || 'unknown';
                } else if (pattern.type === 'homework_problem') {
                    const exercise = homeworkExercises.find(e => e.id === id);
                    parentAttribute = exercise?.homework || 'unknown';
                }
                
                // Group by tag type and parent attribute
                if (!groupedTags[pattern.tagFormat]) {
                    groupedTags[pattern.tagFormat] = {};
                }
                if (!groupedTags[pattern.tagFormat][parentAttribute]) {
                    groupedTags[pattern.tagFormat][parentAttribute] = [];
                }
                groupedTags[pattern.tagFormat][parentAttribute].push(id);
            }
        });
        
        // Replace the entire group with grouped tags
        let tagsReplacement = '';
        
        // Create combined tags for each group
        Object.entries(groupedTags).forEach(([tagFormat, parentGroups]) => {
            Object.entries(parentGroups).forEach(([_, ids]) => {
                tagsReplacement += `::${tagFormat}{id=${ids.join(',')}}`;
            });
        });
        
        if (tagsReplacement) {
            cleanedText = cleanedText.replace(fullMatch, tagsReplacement);
        }
    }

    // Process any remaining individual tags
    documentPatterns.forEach(pattern => {
        cleanedText = cleanedText.replace(pattern.regex, (match, id) => {
            return `::${pattern.tagFormat}{id=${id}}`;
        });
    });

    exercisePatterns.forEach(pattern => {
        cleanedText = cleanedText.replace(pattern.regex, (match, id) => {
            return `::${pattern.tagFormat}{id=${id}}`;
        });
    });

    return cleanedText;
};

// Split text by figure references and other special tags
export const splitTextByTags = (text: string): { text: string; figureId: string | null; summaryId: string | null; questionId: string | null }[] => {
    if (!text) return [];

    const result: { text: string; figureId: string | null; summaryId: string | null; questionId: string | null }[] = [];
    
    // Use regex to properly extract tags and content
    const tagPattern = /<(FIGURE_GENERATION|SUMMARY_GENERATION|QUESTION_GENERATION)>(.*?)<\/(FIGURE_GENERATION|SUMMARY_GENERATION|QUESTION_GENERATION)>/g;
    let lastIndex = 0;
    let match;
    
    while ((match = tagPattern.exec(text)) !== null) {
        const [fullMatch, tagType, content, _] = match;
        const startIndex = match.index;
        
        // Add text before the tag if there is any
        if (startIndex > lastIndex) {
            result.push({
                text: text.slice(lastIndex, startIndex),
                figureId: null,
                summaryId: null,
                questionId: null
            });
        }
        
        // Add the tag with its content
        if (tagType === 'FIGURE_GENERATION') {
            result.push({ 
                text: '', 
                figureId: content.trim(), 
                summaryId: null, 
                questionId: null 
            });
        } else if (tagType === 'SUMMARY_GENERATION') {
            result.push({ 
                text: '', 
                figureId: null, 
                summaryId: content.trim(), 
                questionId: null 
            });
        } else if (tagType === 'QUESTION_GENERATION') {
            result.push({ 
                text: '', 
                figureId: null, 
                summaryId: null, 
                questionId: content.trim() 
            });
        }
        
        lastIndex = startIndex + fullMatch.length;
    }
    
    // Add any remaining text after the last tag
    if (lastIndex < text.length) {
        result.push({
            text: text.slice(lastIndex),
            figureId: null,
            summaryId: null,
            questionId: null
        });
    }

    return result;
};

// Group consecutive document references together
export const groupConsecutiveDocuments = (
    segments: { text: string; documentId: string | null; exerciseId: string | null; documentType: string | null }[],
    lectureDocuments: Document[],
    chapterDocuments: Document[],
    chapterExercises: Exercise[],
    homeworkExercises: Exercise[]
): { text: string; documents: Document[], exercises: Exercise[] }[] => {
    const result: { text: string; documents: Document[], exercises: Exercise[] }[] = [];
    let currentGroup: { text: string; documents: Document[], exercises: Exercise[] } | null = null;

    segments.forEach(segment => {
        if (segment.documentId && segment.documentType === 'lecture') {
            // This is a document reference
            const document = lectureDocuments.find(doc => doc.id === segment.documentId);
            
            if (!currentGroup || currentGroup.text) {
                // Start a new group if we don't have one or if the current group has text
                currentGroup = { text: '', documents: [], exercises: [] };
                result.push(currentGroup);
            }
            
            if (document) {
                currentGroup.documents.push(document);
            }
        } else if (segment.documentId && segment.documentType === 'chapter') {
            // This is a chapter reference
            const document = chapterDocuments.find(doc => doc.id === segment.documentId);
            
            if (!currentGroup || currentGroup.text) {
                // Start a new group if we don't have one or if the current group has text
                currentGroup = { text: '', documents: [], exercises: [] };
                result.push(currentGroup);
            }
            
            if (document) {
                currentGroup.documents.push(document);
            }
        } else if (segment.exerciseId && segment.documentType === 'chapter_exercise') {
            // This is a chapter exercise reference
            const exercise = chapterExercises.find(ex => ex.id === segment.exerciseId);
            
            if (!currentGroup || currentGroup.text) {
                // Start a new group if we don't have one or if the current group has text
                currentGroup = { text: '', documents: [], exercises: [] };
                result.push(currentGroup);
            }
            
            if (exercise) {
                currentGroup.exercises.push(exercise);
            }
        } else if (segment.exerciseId && segment.documentType === 'homework_problem') {
            // This is a homework problem reference
            const exercise = homeworkExercises.find(ex => ex.id === segment.exerciseId);
            
            if (!currentGroup || currentGroup.text) {
                // Start a new group if we don't have one or if the current group has text
                currentGroup = { text: '', documents: [], exercises: [] };
                result.push(currentGroup);
            }
            
            if (exercise) {
                currentGroup.exercises.push(exercise);
            }
        } else if (segment.text) {
            // This is text content
            currentGroup = { text: segment.text, documents: [], exercises: [] };
            result.push(currentGroup);
        }
    });

    return result;
};

// Handle document click with support for different document types
export const handleDocumentClick = (
    contextType: 'lectures' | 'chapters' | 'homeworks' | 'files',
    contextId: string,
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>,
    documentId?: string,
    textbookId?: string,
    exerciseId?: string,
) => {
    // For lectures
    if (contextType === 'lectures' && documentId) {
        setViewerMode(prev => ({
            ...prev,
            active: true,
            open: true,
            documentId: documentId,
            lectureId: contextId,
            chapterId: undefined,
            textbookId: undefined,
            exerciseId: undefined,
            homeworkId: undefined,
            fileId: undefined,
        }));
    }
    // For chapters
    else if (contextType === 'chapters' && documentId && textbookId) {
        setViewerMode(prev => ({
            ...prev,
            active: true,
            open: true,
            documentId: documentId,
            textbookId: textbookId,
            chapterId: contextId,
            lectureId: undefined,
            exerciseId: undefined,
            homeworkId: undefined,
            fileId: undefined,
        }));
    } else if (contextType === 'chapters' && exerciseId && textbookId) {
        setViewerMode(prev => ({
            ...prev,
            active: true,
            open: true,
            chapterId: contextId,
            exerciseId: exerciseId,
            textbookId: textbookId,
            lectureId: undefined,
            homeworkId: undefined,
            documentId: undefined,
            fileId: undefined,
        }));
    } else if (contextType === 'homeworks' && exerciseId) {
        setViewerMode(prev => ({
            ...prev,
            active: true,
            open: true,
            homeworkId: contextId,
            exerciseId: exerciseId,
            lectureId: undefined,
            fileId: undefined,
        }));
    } else if (contextType === 'files' && documentId) {
        setViewerMode(prev => ({
            ...prev,
            active: true,
            open: true,
            fileId: contextId,
            documentId: documentId,
            lectureId: undefined,
            chapterId: undefined,
            textbookId: undefined,
            exerciseId: undefined,
            homeworkId: undefined,
        }));
    }
};
