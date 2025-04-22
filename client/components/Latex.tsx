import ReactMarkdown from 'react-markdown';
import RemarkMathPlugin from 'remark-math';
import RehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import remarkDirective from 'remark-directive';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { Avatar, Badge, Flex, Text } from '@mantine/core';
import { visit } from 'unist-util-visit';
import { Document } from '@/types';
import { IconChevronRight } from '@tabler/icons-react';
import { getFiles } from '@/utils/queries/get-files';
import { useQuery } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { getFileDocuments } from '@/utils/queries/get-file-docs';
import { getProfile } from '@/utils/queries/get-profile';
import { getUser } from '@/utils/queries/get-user';
import { getPageRanges } from '@/utils/chat/chat-helpers';

interface LatexProps {
    children: string;
    classId?: string;
    handleEnhancedDocumentClick?: (contextType: 'files', contextId: string, documentId?: string) => void;
}

// Define consistent colors for different content types
const CONTENT_COLORS = {
    lecture: 'blue',    // matches badge color
    textbook: 'green',   // matches badge color
    homework: 'orange', // matches badge color
    rubric: 'yellow', // matches badge color
    other: 'violet',     // now matches badge color in ContextBadges
} as const;

export default function Latex({ children, classId, handleEnhancedDocumentClick }: LatexProps) {
    const supabase = useSupabaseBrowser();

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    });

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user?.id
    });

    const { data: files, isLoading: loadingFiles } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, classId!),
        enabled: !!classId
    });


    const { data: fileDocuments } = useQuery({
        queryKey: ["fileDocuments", classId],
        queryFn: () => getFileDocuments(supabase, files!.map(f => f.id)),
        enabled: !!files && !!classId
    });


    const getDocumentLabel = (
        doc?: Document,
        range?: string
    ): string => {
        const file = files?.find(f => f.id === doc?.file);
        if (file?.type === 'video' || file?.type === 'audio') {
            const formatTime = (seconds: number) => {
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = Math.floor(seconds % 60);
                return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            };  
            return `${file?.title ?? 'File'} ${formatTime(doc?.start_time ?? 0)} - ${formatTime(doc?.end_time ?? 0)}`;
        } else {
            return `${file?.title ?? 'File'} ${range ? `p.${range}` : `p.${doc?.page}`}`;
        }
    };

    const renderBadges = (documents: Document[]) => {
        // find all of the distinct lectures and chapters in the group
        const groupFiles = Array.from(new Set(documents.filter(doc => doc && doc.file !== null).map(doc => doc.file).filter((fileId) => fileId !== null)))
        // get the page ranges for each lecture and chapter
        const filePageRanges = groupFiles.map(file => getPageRanges(documents.filter(doc => doc && doc.file === file))).flat()
        // combine the page ranges for each lecture and chapter
        const allDocumentPageRanges = [...filePageRanges]

        return (
            <>
                {handleEnhancedDocumentClick && allDocumentPageRanges.length > 0 && allDocumentPageRanges.map((pageRange, pageRangeIndex) => {
                    const label = getDocumentLabel(
                        pageRange.startDocument ?? undefined,
                        pageRange.range
                    );
                    const file_type = files?.find(f => f.id === pageRange.startDocument?.file)?.content_type;
                    return (
                        <Text
                            key={pageRangeIndex}
                            c={CONTENT_COLORS[file_type ?? 'other']}
                            span
                            className="context-reference-link"
                            style={{ 
                                display: 'inline', 
                                margin: '0 0.25rem', 
                                cursor: 'pointer'
                            }}
                            onClick={() => {
                                if (pageRange.startDocument?.file) {
                                    handleEnhancedDocumentClick('files', pageRange.startDocument.file, pageRange.startDocument.id);
                                }
                            }}
                        >
                            {`[${label}]`}
                        </Text>
                    );
                })}
            </>
        )
    }



    // Preprocess the text to replace all tag types with custom HTML
    const processedText = children
        .replace(/::lecture{id=([a-zA-Z0-9,-]+)}/g, '<span class="tag-badge" data-tag-type="lecture" data-tag-id="$1"></span>')
        .replace(/::chapter{id=([a-zA-Z0-9,-]+)}/g, '<span class="tag-badge" data-tag-type="chapter" data-tag-id="$1"></span>')
        .replace(/::file{id=([a-zA-Z0-9,-]+)}/g, '<span class="tag-badge" data-tag-type="file" data-tag-id="$1"></span>')
        .replace(/::exercise{id=([a-zA-Z0-9,-]+)}/g, '<span class="tag-badge" data-tag-type="exercise" data-tag-id="$1"></span>')
        .replace(/::problem{id=([a-zA-Z0-9,-]+)}/g, '<span class="tag-badge" data-tag-type="problem" data-tag-id="$1"></span>')
        .replace(/\n/g, '  \n');

    return (
        <div className="latex-container">
            <ReactMarkdown
                remarkPlugins={[
                    RemarkMathPlugin,
                    remarkGfm,
                    remarkDirective,
                ]}
                rehypePlugins={[
                    RehypeKatex,
                    rehypeRaw, // This is important to parse our custom HTML
                    rehypeSlug,
                    rehypeAutolinkHeadings,
                    [rehypeHighlight, { ignoreMissing: true }]
                ]}
                components={{
                    p: ({ children }) => <p className="prose-p">{children}</p>,
                    h1: ({ children }) => <h1 className="prose-h1">{children}</h1>,
                    h2: ({ children }) => <h2 className="prose-h2">{children}</h2>,
                    ul: ({ children }) => <ul className="prose-ul">{children}</ul>,
                    ol: ({ children }) => <ol className="prose-ol">{children}</ol>,
                    li: ({ children }) => <li className="prose-li">{children}</li>,
                    table: ({ children }) => <table className="prose-table">{children}</table>,
                    th: ({ children }) => <th className="prose-th">{children}</th>,
                    td: ({ children }) => <td className="prose-td">{children}</td>,
                    span: (props: any) => {
                        if (props.className === 'tag-badge' && props['data-tag-id'] && classId) {
                            const tagType = props['data-tag-type'] || 'lecture';
                            const tagIds = props['data-tag-id'].split(',');

                            // find documents and exercises for each tag id
                            const documents = tagIds.map((id: string) => {
                                return fileDocuments?.find((fileDocument: Document) => fileDocument.id === id);
                            });
                            
                            return renderBadges(documents);
                        }
                        return <span {...props} />;
                    }
                }}
            >
                {processedText}
            </ReactMarkdown>
            <style jsx global>{`
                .latex-container {
                    font-size: 1rem;
                    line-height: 1.75;
                }
                
                .prose-p {
                    margin: 1.25em 0;
                }

                .latex-container > :first-child {
                    margin-top: 0;
                }

                .latex-container > :last-child {
                    margin-bottom: 0;
                }

                .prose-h1 {
                    margin: 2em 0 1em;
                    font-size: 2em;
                }

                .prose-h2 {
                    margin: 1.5em 0 0.75em;
                    font-size: 1.5em;
                }

                .prose-ul, .prose-ol {
                    margin: 1.25em 0;
                    padding-left: 1.625em;
                }

                .prose-li {
                    margin: 0.5em 0;
                    padding-left: 0.375em;
                }

                .katex-display {
                    margin: 1em 0 !important;
                    overflow-x: auto;
                    overflow-y: hidden;
                }

                .katex {
                    text-rendering: auto;
                }
                
                /* Table styles */
                .prose-table {
                    width: 100%;
                    margin: 1.5em auto; /* old for left aligned tables: margin: 1.5em 0; */
                    border-collapse: collapse;
                    overflow-x: auto;
                    display: block;
                    max-width: fit-content; /* remove for left aligned tables */
                }
                
                .prose-table table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 0 auto; /* remove for left aligned tables */
                }
                
                .prose-th {
                    padding: 0.75em 1em;
                    border: 1px solid;
                    font-weight: 600;
                    text-align: left;
                    
                    @mixin light {
                        background-color: #f8f9fa;
                        border-color: #e5e7eb;
                    }
                    
                    @mixin dark {
                        background-color: #2c2e33;
                        border-color: #373a40;
                    }
                }
                
                .prose-td {
                    padding: 0.75em 1em;
                    border: 1px solid;
                    vertical-align: top;
                    
                    @mixin light {
                        border-color: #e5e7eb;
                    }
                    
                    @mixin dark {
                        border-color: #373a40;
                    }
                }
                
                .prose-table tr:nth-child(even) {
                    @mixin light {
                        background-color: #f9fafb;
                    }
                    
                    @mixin dark {
                        background-color: #25262b;
                    }
                }
                
                .prose-table tr:nth-child(odd) {
                    @mixin dark {
                        background-color: #2c2e33;
                    }
                }

                /* Badge alignment styles */
                .mantine-Badge-root {
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                }
                
                .mantine-Badge-inner {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    width: 100% !important;
                }
                
                .mantine-Badge-section {
                    display: flex !important;
                    align-items: center !important;
                }
                
                .mantine-Badge-label {
                    flex: 1 !important;
                    text-align: center !important;
                }

                /* Add this new style for the context references */
                .context-reference-link {
                    transition: text-decoration 0.2s ease;
                }
                
                .context-reference-link:hover {
                    text-decoration: underline !important;
                }

                /* Add improved handling for LaTeX content */
                .katex {
                    text-rendering: auto;
                    white-space: nowrap !important;
                }
                
                /* Better handling for inline math */
                span.math.math-inline {
                    white-space: nowrap;
                    display: inline-block;
                }
                
                /* Prevent splitting math expressions */
                .latex-container .katex-display > .katex {
                    display: inline-block;
                    text-align: initial;
                    white-space: nowrap;
                }
                
                /* Ensure sub/superscripts display correctly */
                .katex .msupsub {
                    text-align: left;
                }
                
                /* Ensure math symbols don't break across lines */
                .math-wrapper {
                    display: inline-block;
                    white-space: nowrap;
                }
            `}</style>
        </div>
    );
}