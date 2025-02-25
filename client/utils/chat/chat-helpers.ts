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

// Split text by document references
export const splitTextByDocuments = (text: string): { text: string; documentId: string | null }[] => {
    if (!text) return [];

    const result: { text: string; documentId: string | null }[] = [];
    let currentIndex = 0;

    while (true) {
        // Find the next document tag
        const startIndex = text.indexOf('<DOCUMENT>', currentIndex);
        if (startIndex === -1) {
            // No more document tags, add the remaining text if any
            if (currentIndex < text.length) {
                result.push({
                    text: text.slice(currentIndex),
                    documentId: null
                });
            }
            break;
        }

        // Add the text before the document tag
        if (startIndex > currentIndex) {
            result.push({
                text: text.slice(currentIndex, startIndex),
                documentId: null
            });
        }

        // Find the closing tag
        const endIndex = text.indexOf('</DOCUMENT>', startIndex);
        if (endIndex === -1) {
            // No closing tag found, add remaining text and stop
            result.push({
                text: text.slice(currentIndex),
                documentId: null
            });
            break;
        }

        // Extract the document ID
        const documentId = text.slice(startIndex + 10, endIndex);
        result.push({
            text: '',  // No text content for document references
            documentId
        });

        // Move the current index past the document tag
        currentIndex = endIndex + 11; // 11 is length of '</DOCUMENT>'
    }

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

// Group consecutive document references
export const groupConsecutiveDocuments = (
    segments: { text: string; documentId: string | null }[], 
    allDocuments: Document[]
): { text: string; documents: Document[] }[] => {
    const result: { text: string; documents: Document[] }[] = [];
    let currentGroup: Document[] = [];
    let currentText = '';

    segments.forEach((segment) => {
        if (segment.documentId) {
            const doc = allDocuments.find(d => d.id === segment.documentId);
            if (doc) {
                currentGroup.push(doc);
            }
        } else {
            if (currentGroup.length > 0) {
                result.push({
                    text: currentText,
                    documents: [...currentGroup]
                });
                currentGroup = [];
                currentText = '';
            }
            if (segment.text) {
                result.push({
                    text: segment.text,
                    documents: []
                });
            }
        }
    });

    // Handle any remaining documents
    if (currentGroup.length > 0) {
        result.push({
            text: currentText,
            documents: [...currentGroup]
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
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>
) => {
    if (doc.lecture) {
        setViewerMode({
            active: true,
            documentId: doc.id,
            lectureId: doc.lecture,
        });
    } else if (doc.textbook) {
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
    }
};
