import { Document, ViewerMode } from "@/types";
import { Dispatch, SetStateAction } from "react";

// Split text by document references and preserve formatting
export const splitTextByDocuments = (text: string, fileDocuments: Document[]): string => {

    const documentTags: Array<{id: string}> = [];

    // Extract all document tags and store them with their types
    const documentPatterns = [
        { regex: /<DOCUMENT>([^<]+)<\/DOCUMENT>/g, tagFormat: 'file' }
    ];

    // Find consecutive document tags followed by a period
    const consecutiveDocTagsWithPeriod = /((?:<DOCUMENT>[^<]+<\/DOCUMENT>\s*)+)\./g;
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
                documentTags.push({ id });
                
                // Find the document to check its parent attribute
                const doc = fileDocuments.find(d => d.id === id);
                const parentAttribute = doc?.file || 'unknown';
                
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
        text = text.replace(
            text.substring(beforeTagIndex.length, match.index + fullMatch.length),
            replacementText + tagsReplacement
        );
    }

    // Handle document tags followed by periods (non-consecutive case)
    const docPeriodPatterns = [
        { regex: /<DOCUMENT>([^<]+)<\/DOCUMENT>\s*\./g, tagFormat: 'file' }
    ];

    // Process remaining single tags with periods
    docPeriodPatterns.forEach(pattern => {
        while ((match = pattern.regex.exec(text)) !== null) {
            // Skip if this was already handled by the consecutive tags logic
            if (consecutiveDocTagsWithPeriod.test(match[0])) continue;
            
            documentTags.push({ id: match[1] });
            // Move the period to the front and trim any whitespace
            const beforeTagIndex = text.substring(0, match.index).trimEnd();
            text = text.replace(
                text.substring(beforeTagIndex.length, match.index + match[0].length),
                `.::${pattern.tagFormat}{id=${match[1]}}`
            );
        }
    });

    // Then process regular tags without periods
    // Group consecutive tags of the same type
    const consecutiveDocTags = /((?:<DOCUMENT>[^<]+<\/DOCUMENT>\s*)+)/g;
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
                const doc = fileDocuments.find(d => d.id === id);
                const parentAttribute = doc?.file || 'unknown';
                
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
            text = text.replace(fullMatch, tagsReplacement);
        }
    }

    // Process any remaining individual tags
    documentPatterns.forEach(pattern => {
        text = text.replace(pattern.regex, (match, id) => {
            return `::${pattern.tagFormat}{id=${id}}`;
        });
    });

    return text;
};

// Split text by figure references and other special tags
export const splitTextByTags = (text: string): { text: string; figureId: string | null; summaryId: string | null; questionIds: string[] }[] => {
    if (!text) return [];

    const result: { text: string; figureId: string | null; summaryId: string | null; questionIds: string[] }[] = [];
    
    // Use regex to properly extract tags and content
    const tagPattern = /<(FIGURE|SUMMARY|QUESTION)>(.*?)<\/(FIGURE|SUMMARY|QUESTION)>/g;
    let lastIndex = 0;
    let match;
    
    // First, collect all text segments and tags in order
    const segments: Array<{
        type: 'text' | 'figure' | 'summary' | 'question';
        content: string;
        index: number;
    }> = [];
    
    while ((match = tagPattern.exec(text)) !== null) {
        const [fullMatch, tagType, content, _] = match;
        const startIndex = match.index;
        
        // Add text before the tag if there is any
        if (startIndex > lastIndex) {
            segments.push({
                type: 'text',
                content: text.slice(lastIndex, startIndex),
                index: lastIndex
            });
        }
        
        // Add the tag with its content
        segments.push({
            type: tagType === 'FIGURE' ? 'figure' : 
                  tagType === 'SUMMARY' ? 'summary' : 'question',
            content: content.trim(),
            index: startIndex
        });
        
        lastIndex = startIndex + fullMatch.length;
    }
    
    // Add any remaining text after the last tag
    if (lastIndex < text.length) {
        segments.push({
            type: 'text',
            content: text.slice(lastIndex),
            index: lastIndex
        });
    }
    
    // Now process the segments to group consecutive questions if needed
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        if (segment.type === 'text') {
            result.push({
                text: segment.content,
                figureId: null,
                summaryId: null,
                questionIds: []
            });
        } else if (segment.type === 'figure') {
            result.push({ 
                text: '', 
                figureId: segment.content, 
                summaryId: null, 
                questionIds: [] 
            });
        } else if (segment.type === 'summary') {
            result.push({ 
                text: '', 
                figureId: null, 
                summaryId: segment.content, 
                questionIds: [] 
            });
        } else if (segment.type === 'question') {
            // Check if there are consecutive questions
            let questionIds = [segment.content];
            let j = i + 1;
            
            // Skip any empty text segments between questions
            while (j < segments.length && 
                   ((segments[j].type === 'text' && segments[j].content.trim() === '') || 
                    segments[j].type === 'question')) {
                if (segments[j].type === 'question') {
                    questionIds.push(segments[j].content);
                }
                j++;
            }
            
            // If we found consecutive questions, skip them in the main loop
            if (j > i + 1) {
                i = j - 1;
            }
            
            // Add the question(s) to the result
            result.push({ 
                text: '', 
                figureId: null, 
                summaryId: null, 
                questionIds: questionIds 
            });
        }
    }

    return result;
};

// Handle document click with support for different document types
export const handleDocumentClick = (
    fileId: string,
    documentId: string,
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>,
    showPageDetails: boolean
) => {
    if (setViewerMode) {
        setViewerMode(prev => ({
            ...prev,
            active: true,
            open: true,
            fileId: fileId,
            documentId: documentId,
            showPageDetails: showPageDetails
        }));
    }
};

export const getPageRanges = (documents: Document[]): { startDocument: Document | null, endDocument: Document | null, range: string }[] => {
    if (!documents.length) return [];

    const pageRanges: { startDocument: Document | null, endDocument: Document | null, range: string }[] = [];

    if (documents.length > 0) {
        // Remove duplicates and sort
        const uniquePages = Array.from(new Set(documents.map(doc => doc.page))).sort((a, b) => a - b);
        let start = uniquePages[0];
        let prev = uniquePages[0];

        for (let i = 1; i <= uniquePages.length; i++) {
            if (i === uniquePages.length || uniquePages[i] !== prev + 1) {
                const startDocument = documents.find(doc => doc.page === start);
                const endDocument = documents.find(doc => doc.page === prev);
                if (startDocument && endDocument) {
                    pageRanges.push({ startDocument: startDocument, endDocument: endDocument, range: start === prev ? `${start}` : `${start}-${prev}` });
                }
                if (i < uniquePages.length) {
                    start = uniquePages[i];
                    prev = uniquePages[i];
                }
            } else {
                prev = uniquePages[i];
            }
        }
    }

    return pageRanges;
};