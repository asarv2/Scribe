import { Chapter, Document, Exercise, Homework, Lecture, Textbook, ViewerMode } from "@/types";
import { Dispatch, SetStateAction } from "react";

// Filter out code blocks from text but preserve text content
export const filterCodeBlocks = (text: string): string => {
    if (!text) return '';

    let result = '';
    let currentIndex = 0;

    // Handle <CODE> tags
    while (true) {
        // Find the next code block start
        const startIndex = text.indexOf('<CODE>', currentIndex);
        if (startIndex === -1) {
            // No more code blocks, add the remaining text
            result += text.slice(currentIndex);
            break;
        }

        // Add the text before the code block
        result += text.slice(currentIndex, startIndex);

        // Find the closing tag
        const endIndex = text.indexOf('</CODE>', startIndex);
        if (endIndex === -1) {
            // No closing tag found, add placeholder and stop
            result += '<FIGURE>code-placeholder</FIGURE>';
            break;
        }

        // Add placeholder for the code block
        result += '<FIGURE>code-placeholder</FIGURE>';

        // Move the current index past the code block
        currentIndex = endIndex + 7; // 7 is length of '</CODE>'
    }

    // Also filter out triple backtick code blocks
    return filterTripleBacktickCodeBlocks(result);
};

// Filter out triple backtick code blocks
export const filterTripleBacktickCodeBlocks = (text: string): string => {
    if (!text) return '';
    
    // Regular expression to match complete triple backtick code blocks
    const completeCodeBlockRegex = /```[\s\S]*?```/g;
    
    // Replace complete code blocks with a figure placeholder
    let processedText = text.replace(completeCodeBlockRegex, '<FIGURE>code-placeholder</FIGURE>');
    
    // Check for incomplete code blocks (opening ``` without closing ```)
    const incompleteCodeBlockIndex = processedText.lastIndexOf('```');
    if (incompleteCodeBlockIndex !== -1 && 
        processedText.indexOf('```', incompleteCodeBlockIndex + 3) === -1) {
        // There's an opening ``` without a closing one
        processedText = processedText.substring(0, incompleteCodeBlockIndex) + 
                        '<FIGURE>code-placeholder</FIGURE>';
    }
    
    return processedText;
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

// Split text by figure references
export const splitTextByFigures = (text: string): { text: string; figureId: string | null }[] => {
    if (!text) return [];

    const result: { text: string; figureId: string | null }[] = [];
    let currentIndex = 0;

    while (true) {
        // Find the next figure tag
        const startIndex = text.indexOf('<FIGURE>', currentIndex);
        if (startIndex === -1) {
            // No more figure tags, add the remaining text if any
            if (currentIndex < text.length) {
                result.push({
                    text: text.slice(currentIndex),
                    figureId: null
                });
            }
            break;
        }

        // Add the text before the figure tag
        if (startIndex > currentIndex) {
            result.push({
                text: text.slice(currentIndex, startIndex),
                figureId: null
            });
        }

        // Find the closing tag
        const endIndex = text.indexOf('</FIGURE>', startIndex);
        if (endIndex === -1) {
            // No closing tag found, add remaining text and stop
            result.push({
                text: text.slice(currentIndex),
                figureId: null
            });
            break;
        }

        // Extract the figure ID
        const figureId = text.slice(startIndex + 8, endIndex);
        result.push({
            text: '',  // No text content for figure references
            figureId
        });

        // Move the current index past the figure tag
        currentIndex = endIndex + 9; // 9 is length of '</FIGURE>'
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
    contextType: 'lectures' | 'chapters' | 'homeworks',
    contextId: string,
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>,
    documentId?: string,
    textbookId?: string,
    exerciseId?: string,
) => {
    // For lectures
    if (contextType === 'lectures' && documentId) {
        setViewerMode({
            active: true,
            documentId: documentId,
            lectureId: contextId,
        });
    }
    // For chapters
    else if (contextType === 'chapters' && documentId && textbookId) {
        setViewerMode({
            active: true,
            documentId: documentId,
            textbookId: textbookId,
            chapterId: contextId,
        });
    } else if (contextType === 'chapters' && exerciseId) {
        setViewerMode({
            active: true,
            chapterId: contextId,
            exerciseId: exerciseId,
        });
    } else if (contextType === 'homeworks' && exerciseId) {
        setViewerMode({
            active: true,
            homeworkId: contextId,
            exerciseId: exerciseId,
        });
    }
};
