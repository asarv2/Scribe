import { Chapter, Document, ViewerMode } from "@/types";
import { Dispatch, SetStateAction } from "react";

// Filter out code blocks from text
export const filterCodeBlocks = (text: string): string => {
    if (!text) return '';

    let result = '';
    let currentIndex = 0;

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
            // No closing tag found, stop here
            break;
        }

        // Move the current index past the code block
        currentIndex = endIndex + 7; // 7 is length of '</CODE>'
    }

    return result;
};

// Split text by document references and preserve formatting
export const splitTextByDocuments = (text: string): { text: string; documentId: string | null }[] => {
    if (!text) return [];

    const documentTags: string[] = [];
    let cleanedText = text;

    // First extract all document tags and store them
    const documentRegex = /<DOCUMENT>([^<]+)<\/DOCUMENT>/g;
    let match;
    while ((match = documentRegex.exec(text)) !== null) {
        documentTags.push(match[1]);
        // Replace the document tag with a placeholder to preserve formatting
        cleanedText = cleanedText.replace(match[0], '');
    }

    const result: { text: string; documentId: string | null }[] = [];
    
    // Add the main text if it exists (with preserved formatting)
    if (cleanedText.trim()) {
        result.push({
            text: cleanedText.trim(),
            documentId: null
        });
    }

    // Add all document references at the end
    documentTags.forEach(docId => {
        result.push({
            text: '',
            documentId: docId
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

// Group consecutive document references at the end
export const groupConsecutiveDocuments = (
    segments: { text: string; documentId: string | null }[], 
    allDocuments: Document[]
): { text: string; documents: Document[] }[] => {
    const result: { text: string; documents: Document[] }[] = [];
    const documents: Document[] = [];

    // First add all text segments
    segments.forEach(segment => {
        if (!segment.documentId && segment.text) {
            result.push({
                text: segment.text,
                documents: []
            });
        } else if (segment.documentId) {
            const doc = allDocuments.find(d => d.id === segment.documentId);
            if (doc) {
                documents.push(doc);
            }
        }
    });

    // Then add all documents as a single group at the end if there are any
    if (documents.length > 0) {
        result.push({
            text: '',
            documents: documents
        });
    }

    return result;
};

// Get document label for display
export const getDocumentLabel = (
    doc: Document, 
    lectures: any[], 
    textbooks: any[]
): string => {
    if (doc.lecture) {
        const lecture = lectures?.find(l => l.id === doc.lecture);
        return `${lecture?.name ?? 'Lecture'} p.${doc.page}`;
    } else if (doc.textbook) {
        const textbook = textbooks?.find(t => t.id === doc.textbook);
        return `${textbook?.title ?? 'Textbook'} p.${doc.page}`;
    }
    return 'Document Reference';
};

// Handle document click
export const handleDocumentClick = (
    doc: Document, 
    chapters: Chapter[], 
    type: 'lecture' | 'chapter' | 'exercise' | 'homework',
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>
) => {
    if (type === 'lecture' && doc.lecture) {
        setViewerMode({
            active: true,
            documentId: doc.id,
            lectureId: doc.lecture,
        });
    } else if (type === 'chapter' && doc.textbook) {
        const chapter = chapters?.find(c =>
            doc.page >= c.start_page &&
            doc.page <= c.end_page &&
            c.textbook === doc.textbook
        );
        if (chapter) {
            setViewerMode({
                active: true,
                documentId: doc.id,
                textbookId: doc.textbook,
                chapterId: chapter.id,
            });
        }
    } else if (type === 'homework' && doc.homeworks) {
        setViewerMode({
            active: true,
            documentId: doc.id,
            homeworkId: doc.homeworks[0],
            exerciseId: doc.exercises[0] ?? undefined,
        });
    } else if (type === 'exercise' && doc.exercise) {
        const chapter = chapters?.find(c => doc.chapter === c.id);
        if (chapter) {
            setViewerMode({
                active: true,
                documentId: doc.id,
                textbookId: doc.textbook ?? undefined,
                chapterId: chapter.id,
                exerciseId: doc.exercise,
            });
        }
    } else {
        throw new Error('Invalid document type');
    }
};
