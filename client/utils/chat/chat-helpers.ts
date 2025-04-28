import { Document, ViewerMode } from "@/types";

// Pre-compile once
const TAG_REGEX = /<DOCUMENT>([^<]+)<\/DOCUMENT>/g;

/**
 * Turn a group of consecutive <DOCUMENT>…</DOCUMENT> tags
 * into the compact ::file{id=1,2} syntax.  Handles the leading-period
 * rule and keeps original text outside the tags untouched.
 */
export function splitTextByDocuments(
    input: string,
    fileDocuments: Document[],
): string {
    if (!input?.length) return "";

    // Fast lookup
    const docById = new Map(fileDocuments.map((d) => [d.id, d]));

    // --- 1. Tokenise -------------------------------------------------
    type Tok =
        | { kind: "text"; value: string }
        | { kind: "tag"; id: string };

    const tokens: Tok[] = [];
    let lastIndex = 0;

    for (const m of input.matchAll(TAG_REGEX)) {
        // text before the tag
        if (m.index! > lastIndex) {
            tokens.push({
                kind: "text",
                value: input.slice(lastIndex, m.index),
            });
        }
        tokens.push({ kind: "tag", id: m[1] });
        lastIndex = m.index! + m[0].length;
    }
    // trailing text
    if (lastIndex < input.length) {
        tokens.push({ kind: "text", value: input.slice(lastIndex) });
    }

    // --- 2. Walk once & build output --------------------------------
    const out: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];

        if (t.kind === "tag") {
            // collect a run of consecutive tags
            const runIds: string[] = [t.id];
            while (tokens[i + 1]?.kind === "tag") {
                runIds.push((tokens[++i] as any).id);
            }

            // look ahead for a period directly *after* the tag run
            const nextToken = tokens[i + 1];
            const nextIsPeriod = nextToken?.kind === "text" &&
                nextToken.value.match(/^\s*\./);

            if (nextIsPeriod) {
                const nextToken = tokens[i + 1];
                // shift the period text so that '.' appears before the compact tag
                nextToken?.kind === "text" &&
                    (nextToken!.value = nextToken!.value.replace(/^\s*\./, ""));
                pushAndTidy(out, ".");
            }

            pushAndTidy(out, compact(runIds, docById));
        } else {
            pushAndTidy(out, t.value);
        }
    }

    const result = out.join("");

    return result;
}

function pushAndTidy(buf: string[], chunk: string) {
    if (chunk === "." && buf.length) {
      // kill trailing whitespace in the previous segment
      buf[buf.length - 1] = buf[buf.length - 1].replace(/\s+$/, "");
    }
    buf.push(chunk);
}

/** Builds ::file{id=…} with parent grouping (if you care). */
function compact(
    ids: string[],
    docs: Map<string, Document>,
): string {
    // group by parent(file) if you still need that feature
    const byParent: Record<string, string[]> = {};
    for (const id of ids) {
        const parent = docs.get(id)?.file ?? "unknown";
        (byParent[parent] ??= []).push(id);
    }

    return Object.values(byParent)
        .map((groupIds) => `::file{id=${groupIds.join(",")}}`)
        .join("");
}

// Split text by figure references and other special tags
export const splitTextByTags = (text: string): Array<{
    text: string | null;
    figureIds: string[] | null;
    summaryIds: string[] | null;
    questionIds: string[] | null;
}> => {
    if (!text) return [];

    const result: Array<{
        text: string | null;
        figureIds: string[] | null;
        summaryIds: string[] | null;
        questionIds: string[] | null;
    }> = [];

    // Use regex to properly extract tags and content
    const tagPattern =
        /<(FIGURE|SUMMARY|QUESTION)>(.*?)<\/(FIGURE|SUMMARY|QUESTION)>/g;
    let lastIndex = 0;
    let match;

    // First, collect all text segments and tags in order
    const segments: Array<{
        type: "text" | "figure" | "summary" | "question";
        content: string;
        index: number;
    }> = [];

    while ((match = tagPattern.exec(text)) !== null) {
        const [fullMatch, tagType, content, _] = match;
        const startIndex = match.index;

        // Add text before the tag if there is any
        if (startIndex > lastIndex) {
            segments.push({
                type: "text",
                content: text.slice(lastIndex, startIndex),
                index: lastIndex,
            });
        }

        // Add the tag with its content
        segments.push({
            type: tagType === "FIGURE"
                ? "figure"
                : tagType === "SUMMARY"
                ? "summary"
                : "question",
            content: content.trim(),
            index: startIndex,
        });

        lastIndex = startIndex + fullMatch.length;
    }

    // Add any remaining text after the last tag
    if (lastIndex < text.length) {
        segments.push({
            type: "text",
            content: text.slice(lastIndex),
            index: lastIndex,
        });
    }

    // Collect all figures, summaries, and questions
    const allFigureIds: string[] = [];
    const allSummaryIds: string[] = [];
    const allQuestionIds: string[] = [];

    // First pass: collect all IDs by type
    segments.forEach((segment) => {
        if (segment.type === "figure") {
            allFigureIds.push(segment.content);
        } else if (segment.type === "summary") {
            allSummaryIds.push(segment.content);
        } else if (segment.type === "question") {
            allQuestionIds.push(segment.content);
        }
    });

    // Track if we've already added each type
    let figuresAdded = false;
    let summariesAdded = false;
    let questionsAdded = false;

    // Second pass: create result objects
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        if (segment.type === "text") {
            // Only add text segments if they contain non-whitespace content
            if (segment.content.trim() !== "") {
                result.push({
                    text: segment.content,
                    figureIds: null,
                    summaryIds: null,
                    questionIds: null,
                });
            }
        } else if (segment.type === "figure" && !figuresAdded) {
            // Add all figures at the first figure position
            result.push({
                text: null,
                figureIds: allFigureIds,
                summaryIds: null,
                questionIds: null,
            });
            figuresAdded = true;
        } else if (segment.type === "summary" && !summariesAdded) {
            // Add all summaries at the first summary position
            result.push({
                text: null,
                figureIds: null,
                summaryIds: allSummaryIds,
                questionIds: null,
            });
            summariesAdded = true;
        } else if (segment.type === "question" && !questionsAdded) {
            // Add all questions at the first question position
            result.push({
                text: null,
                figureIds: null,
                summaryIds: null,
                questionIds: allQuestionIds,
            });
            questionsAdded = true;
        }
        // Skip other occurrences of figures, summaries, and questions
    }

    return result;
};

// Handle document click with support for different document types
export const handleDocumentClick = (
    fileId: string,
    documentId: string,
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>,
    showPageDetails: boolean,
) => {
    if (setViewerMode) {
        setViewerMode((prev) => ({
            ...prev,
            active: true,
            open: true,
            fileId: fileId,
            documentId: documentId,
            showPageDetails: showPageDetails,
        }));
    }
};

export const getPageRanges = (
    documents: Document[],
): {
    startDocument: Document | null;
    endDocument: Document | null;
    range: string;
}[] => {
    if (!documents.length) return [];

    const pageRanges: {
        startDocument: Document | null;
        endDocument: Document | null;
        range: string;
    }[] = [];

    if (documents.length > 0) {
        // Remove duplicates and sort
        const uniquePages = Array.from(
            new Set(documents.map((doc) => doc.page)),
        ).sort((a, b) => a - b);
        let start = uniquePages[0];
        let prev = uniquePages[0];

        for (let i = 1; i <= uniquePages.length; i++) {
            if (i === uniquePages.length || uniquePages[i] !== prev + 1) {
                const startDocument = documents.find((doc) =>
                    doc.page === start
                );
                const endDocument = documents.find((doc) => doc.page === prev);
                if (startDocument && endDocument) {
                    pageRanges.push({
                        startDocument: startDocument,
                        endDocument: endDocument,
                        range: start === prev ? `${start}` : `${start}-${prev}`,
                    });
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

// Split text by generation placeholder tags
export const splitTextByGenerationTags = (text: string): Array<{
    text: string | null;
    figure: boolean;
    summary: boolean;
    question: boolean;
}> => {
    if (!text) return [];

    const result: Array<{
        text: string | null;
        figure: boolean;
        summary: boolean;
        question: boolean;
    }> = [];

    // Find all tag positions in the original text
    const allTagMatches: Array<
        { type: string; index: number; length: number }
    > = [];
    const tagRegex = /<(FIGURE|SUMMARY|QUESTION)_GENERATING>/g;
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
        allTagMatches.push({
            type: match[1].toLowerCase(),
            index: match.index,
            length: match[0].length,
        });
    }

    // Sort all tags by their position
    allTagMatches.sort((a, b) => a.index - b.index);

    // If no tags, just return the text
    if (allTagMatches.length === 0) {
        if (text.trim()) {
            result.push({
                text: text,
                figure: false,
                summary: false,
                question: false,
            });
        }
        return result;
    }

    // Track which tag types we've already processed
    const processedTagTypes = {
        figure: false,
        summary: false,
        question: false,
    };

    // Process text and tags
    let lastIndex = 0;

    for (let i = 0; i < allTagMatches.length; i++) {
        const currentTag = allTagMatches[i];
        const tagType = currentTag.type as "figure" | "summary" | "question";

        // Add text segment before this tag if there is any
        if (currentTag.index > lastIndex) {
            const textSegment = text.substring(lastIndex, currentTag.index)
                .trim();
            if (textSegment) {
                result.push({
                    text: textSegment,
                    figure: false,
                    summary: false,
                    question: false,
                });
            }
        }

        // Add the tag if we haven't processed this type yet
        if (!processedTagTypes[tagType]) {
            processedTagTypes[tagType] = true;

            result.push({
                text: null,
                figure: tagType === "figure",
                summary: tagType === "summary",
                question: tagType === "question",
            });
        }

        // Update lastIndex to after this tag
        lastIndex = currentTag.index + currentTag.length;
    }

    // Add any remaining text after the last tag
    if (lastIndex < text.length) {
        const finalText = text.substring(lastIndex).trim();
        if (finalText) {
            result.push({
                text: finalText,
                figure: false,
                summary: false,
                question: false,
            });
        }
    }

    return result;
};
