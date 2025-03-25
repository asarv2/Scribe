import { Chapter, Document, Exercise, Homework, Lecture, Textbook, ViewerMode } from "@/types";
import { Dispatch, SetStateAction } from "react";

// Filter out code blocks from text but preserve text content
export const filterCodeBlocks = (text: string): string => {
    if (!text) return '';

    let result = text;
    
    // Replace <CODE> tags with placeholders
    result = result.replace(/<FIGURE>[\s\S]*?<\/FIGURE>/g, '<FIGURE_GENERATION>figure-placeholder</FIGURE_GENERATION>');
    
    // Replace <SUMMARY> tags with placeholders
    result = result.replace(/<SUMMARY>[\s\S]*?<\/SUMMARY>/g, '<SUMMARY_GENERATION>summary-placeholder</SUMMARY_GENERATION>');
    
    // Replace <QUESTION> tags with placeholders
    result = result.replace(/<QUESTION>[\s\S]*?<\/QUESTION>/g, '<QUESTION_GENERATION>question-placeholder</QUESTION_GENERATION>');
    
    return result;
};

// Split text by document references and preserve formatting
export const splitTextByDocuments = (text: string): { text: string; documentId: string | null; exerciseId: string | null; documentType: 'lecture' | 'chapter' | 'chapter_exercise' | 'homework_problem' | null }[] => {
    if (!text) return [];

    const documentTags: Array<{id: string, type: 'lecture' | 'chapter'}> = [];
    const exerciseTags: Array<{id: string, type: 'chapter_exercise' | 'homework_problem'}> = [];
    let cleanedText = text;

    // Extract all document tags and store them with their types
    const documentPatterns = [
        { regex: /<DOCUMENT_LECTURE>([^<]+)<\/DOCUMENT_LECTURE>/g, type: 'lecture' },
        { regex: /<DOCUMENT_CHAPTER>([^<]+)<\/DOCUMENT_CHAPTER>/g, type: 'chapter' },
    ];

    const exercisePatterns = [
        { regex: /<EXERCISE_CHAPTER>([^<]+)<\/EXERCISE_CHAPTER>/g, type: 'chapter_exercise' },
        { regex: /<PROBLEM_HOMEWORK>([^<]+)<\/PROBLEM_HOMEWORK>/g, type: 'homework_problem' }
    ];

    documentPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.regex.exec(text)) !== null) {
            documentTags.push({ id: match[1], type: pattern.type as 'lecture' | 'chapter' });
            // Replace the document tag with empty string to preserve formatting
            cleanedText = cleanedText.replace(match[0], '');
        }
    });

    exercisePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.regex.exec(text)) !== null) {
            exerciseTags.push({ id: match[1], type: pattern.type as 'chapter_exercise' | 'homework_problem' });
            // Replace the exercise tag with empty string to preserve formatting
            cleanedText = cleanedText.replace(match[0], '');
        }
    });

    const result: { text: string; documentId: string | null; exerciseId: string | null; documentType: 'lecture' | 'chapter' | 'chapter_exercise' | 'homework_problem' | null }[] = [];
    
    // Add the main text if it exists (with preserved formatting)
    if (cleanedText.trim()) {
        result.push({
            text: cleanedText.trim(),
            documentId: null,
            exerciseId: null,
            documentType: null
        });
    }

    // Add all document references at the end
    documentTags.forEach(doc => {
        result.push({
            text: '',
            documentId: doc.id,
            exerciseId: null,
            documentType: doc.type
        });
    });

    // Add all exercise references at the end
    exerciseTags.forEach(exercise => {
        result.push({
            text: '',
            documentId: null,
            exerciseId: exercise.id,
            documentType: exercise.type
        });
    });

    return result;
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
            contextActive: true,
            contextOpen: true,
            documentId: documentId,
            lectureId: contextId,
            chapterId: undefined,
            textbookId: undefined,
            exerciseId: undefined,
            homeworkId: undefined,
        }));
    }
    // For chapters
    else if (contextType === 'chapters' && documentId && textbookId) {
        setViewerMode(prev => ({
            ...prev,
            contextActive: true,
            contextOpen: true,
            documentId: documentId,
            textbookId: textbookId,
            chapterId: contextId,
            lectureId: undefined,
            exerciseId: undefined,
            homeworkId: undefined,
        }));
    } else if (contextType === 'chapters' && exerciseId && textbookId) {
        setViewerMode(prev => ({
            ...prev,
            contextActive: true,
            contextOpen: true,
            chapterId: contextId,
            exerciseId: exerciseId,
            textbookId: textbookId,
            lectureId: undefined,
            homeworkId: undefined,
            documentId: undefined,
        }));
    } else if (contextType === 'homeworks' && exerciseId) {
        setViewerMode(prev => ({
            ...prev,
            contextActive: true,
            contextOpen: true,
            homeworkId: contextId,
            exerciseId: exerciseId,
            lectureId: undefined,
        }));
    } else if (contextType === 'files' && documentId) {
        setViewerMode(prev => ({
            ...prev,
            contextActive: true,
            contextOpen: true,
            fileId: contextId,
            documentId: documentId,
        }));
    }
};
