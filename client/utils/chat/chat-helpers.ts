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

export const splitTextByGenerationTags = (text: string): Array<{
    text: string | null;
    figure: boolean;
    summary: boolean;
    question: boolean;
    report: boolean;
    handoff: boolean;
}> => {
    if (!text) return [];

    type TagMatch = {
        type: "figure" | "summary" | "question" | "report" | "handoff";
        index: number;
        length: number;
        innerText?: string; // only for handoff
    };

    const result: Array<{
        text: string | null;
        figure: boolean;
        summary: boolean;
        question: boolean;
        report: boolean;
        handoff: boolean;
    }> = [];

    // Combined regex: generation OR handoff-with-inner-text
    const tagRegex =
        /<(FIGURE|SUMMARY|QUESTION|REPORT)_GENERATING>|<HANDOFF>([\s\S]*?)<\/HANDOFF>/g;
    const allTagMatches: TagMatch[] = [];
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(text)) !== null) {
        if (match[1]) {
            // one of the GENERATING tags
            allTagMatches.push({
                type: match[1].toLowerCase() as any,
                index: match.index,
                length: match[0].length,
            });
        } else if (match[2] !== undefined) {
            // a handoff tag
            allTagMatches.push({
                type: "handoff",
                index: match.index,
                length: match[0].length,
                innerText: match[2].trim(),
            });
        }
    }

    // sort by position in original text
    allTagMatches.sort((a, b) => a.index - b.index);

    // if no tags, just return the whole text
    if (!allTagMatches.length) {
        const t = text.trim();
        if (t) {
            result.push({
                text: t,
                figure: false,
                summary: false,
                question: false,
                report: false,
                handoff: false,
            });
        }
        return result;
    }

    // track which GENERATING tags we've already emitted
    const processedTagTypes: Record<
        "figure" | "summary" | "question" | "report",
        boolean
    > = {
        figure: false,
        summary: false,
        question: false,
        report: false,
    };

    let lastIndex = 0;

    for (const tag of allTagMatches) {
        // 1) any plain text before this tag?
        if (tag.index > lastIndex) {
            const segment = text.substring(lastIndex, tag.index).trim();
            if (segment) {
                result.push({
                    text: segment,
                    figure: false,
                    summary: false,
                    question: false,
                    report: false,
                    handoff: false,
                });
            }
        }

        // 2) now handle the tag itself
        if (tag.type === "handoff") {
            // always emit every handoff
            result.push({
                text: tag.innerText || null,
                figure: false,
                summary: false,
                question: false,
                report: false,
                handoff: true,
            });
        } else if (!processedTagTypes[tag.type]) {
            // GENERATING tags: only emit once
            processedTagTypes[tag.type] = true;
            result.push({
                text: null,
                figure: tag.type === "figure",
                summary: tag.type === "summary",
                question: tag.type === "question",
                report: tag.type === "report",
                handoff: false,
            });
        }

        // advance past the entire tag
        lastIndex = tag.index + tag.length;
    }

    // 3) any trailing text after all tags?
    if (lastIndex < text.length) {
        const segment = text.substring(lastIndex).trim();
        if (segment) {
            result.push({
                text: segment,
                figure: false,
                summary: false,
                question: false,
                report: false,
                handoff: false,
            });
        }
    }

    return result;
};
