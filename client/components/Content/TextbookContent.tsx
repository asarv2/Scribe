/**
 * TextbookContent.tsx
 * This component will be used to display the content of a textbook.
 * @AshokSaravanan222
 * 03/06/2025
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { Button, Card, Stack, Text, Progress, Group, Box, Collapse, Skeleton } from "@mantine/core";
import { IconRefresh, IconUpload, IconPencil, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { Textbook, Chapter } from "@/types";

interface TextbookContentProps {
    classId: string;
    textbooks: Textbook[] | undefined;
    textbookDocuments: any[] | undefined;
    chapters: Record<string, Chapter[]> | undefined;
    loadingTextbooks: boolean;
    loadingTextbookDocuments: boolean;
    parsingTextbooks: Set<string>;
    setParsingTextbooks: (value: React.SetStateAction<Set<string>>) => void;
    handleRetryTextbook: (classId: string, textbook: Textbook) => void;
    displayMode: 'horizontal' | 'vertical';
}

export default function TextbookContent({
    classId,
    textbooks,
    textbookDocuments,
    chapters,
    loadingTextbooks,
    loadingTextbookDocuments,
    parsingTextbooks,
    setParsingTextbooks,
    handleRetryTextbook,
    displayMode
}: TextbookContentProps) {
    
    // Track which textbooks are expanded to show chapters
    const [expandedTextbooks, setExpandedTextbooks] = useState<Set<string>>(new Set());
    // Track which chapters are being parsed
    const [parsingChapters, setParsingChapters] = useState<Set<string>>(new Set());
    // Track chapter processing status
    const [chapterProcessingStatus, setChapterProcessingStatus] = useState<Record<string, {
        processed: boolean;
        total: number;
        processedCount: number;
    }>>({});

    // Toggle textbook expansion
    const toggleTextbookExpansion = (textbookId: string) => {
        setExpandedTextbooks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(textbookId)) {
                newSet.delete(textbookId);
            } else {
                newSet.add(textbookId);
            }
            return newSet;
        });
    };

    // Calculate chapter processing status
    useEffect(() => {
        if (!chapters || !textbookDocuments) return;
        
        const newStatus: Record<string, {
            processed: boolean;
            total: number;
            processedCount: number;
        }> = {};
        
        // For each textbook
        Object.entries(chapters).forEach(([textbookId, textbookChapters]) => {
            // For each chapter in the textbook
            textbookChapters.forEach(chapter => {
                // Find documents for this chapter
                const chapterDocs = textbookDocuments.filter(doc => 
                    doc.textbook === textbookId && 
                    doc.chapter === chapter.id
                );
                
                // Count processed documents
                const processedDocs = chapterDocs.filter(doc => doc.processed);
                
                // Calculate total expected documents (pages in chapter)
                const totalDocs = chapter.end_page - chapter.start_page + 1;
                
                // Set status
                newStatus[chapter.id] = {
                    processed: processedDocs.length >= totalDocs && totalDocs > 0,
                    total: totalDocs,
                    processedCount: processedDocs.length
                };
            });
        });
        
        setChapterProcessingStatus(newStatus);
    }, [chapters, textbookDocuments]);

    // Handle retry for a specific chapter
    const handleRetryChapter = async (classId: string, textbookId: string, chapter: Chapter) => {
        try {
            setParsingChapters(prev => new Set(prev).add(chapter.id));
            
            // Make API call to retry parsing this specific chapter
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/parse/textbook`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    textbook_id: textbookId,
                    chapter_id: chapter.id,
                })
            });
            
        } catch (error) {
            console.error('Error retrying chapter:', error);
        } finally {
            // Remove from parsing set after a delay to show loading state
            setTimeout(() => {
                setParsingChapters(prev => {
                    const next = new Set(prev);
                    next.delete(chapter.id);
                    return next;
                });
            }, 2000);
        }
    };

    // Textbook functions
    const getTextbookProgress = useMemo(() => {
        return (textbookId: string, uploading: boolean = false) => {
            if (!textbookDocuments || !textbooks) return 0;
            const filteredDocs = textbookDocuments.filter(document =>
                document.textbook === textbookId && (uploading || document.processed)
            );
            const textbook = textbooks.find(textbook => textbook.id === textbookId);
            if (!textbook || textbook.pages === 0) return 0;
            return (filteredDocs.length / textbook.pages) * 100;
        };
    }, [textbookDocuments, textbooks]);

    const getTextbookEstimatedTime = useMemo(() => {
        return (textbookId: string, uploading: boolean = false) => {
            const textbook = textbooks?.find(textbook => textbook.id === textbookId);
            if (!textbook || textbook.pages === 0) return 0;
            return Number(((textbook.pages * 4)) * (100 - getTextbookProgress(textbookId, uploading)) / 100).toFixed(2);
        };
    }, [textbooks, getTextbookProgress]);

    const getTextbookImage = (textbookId: string) => {
        if (!textbookId) return '/placeholder_image.svg';
        const document = textbookDocuments?.find(document => document.textbook === textbookId);
        if (!document) return '/placeholder_image.svg';
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${document.textbook}/${document.id}.png`
    };

    const getChapterImage = (textbookId: string, chapterId: string) => {
        const chapter = chapters?.[textbookId]?.find(chapter => chapter.id === chapterId);
        if (!chapter) return '/placeholder_image.svg';
        const filteredDocuments = textbookDocuments?.filter(document => 
            document.textbook === textbookId && 
            document.page >= chapter.start_page && 
            document.page <= chapter.end_page
        );
        if (!filteredDocuments || filteredDocuments.length === 0) return '/placeholder_image.svg';
        const document = filteredDocuments[0];
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${textbookId}/${document.id}.png`
    };

    // Get chapter processing progress percentage
    const getChapterProgress = (chapterId: string) => {
        const status = chapterProcessingStatus[chapterId];
        if (!status || status.total === 0) return 0;
        return (status.processedCount / status.total) * 100;
    };

    // Skeleton component for content items
    function ContentSkeleton() {
        return (
            <Card withBorder style={{ width: displayMode === 'horizontal' ? '300px' : '100%', flexShrink: 0 }}>
                <Group align="flex-start">
                    <Skeleton height={150} width={150} />
                    <Stack gap="xs">
                        <Skeleton height={24} width={200} />
                        <Skeleton height={16} width={150} />
                    </Stack>
                </Group>
            </Card>
        );
    }

    if (loadingTextbooks || loadingTextbookDocuments) {
        return (
            <Group wrap={displayMode === 'horizontal' ? 'nowrap' : 'wrap'}>
                <ContentSkeleton />
                <ContentSkeleton />
                <ContentSkeleton />
            </Group>
        );
    }

    if (!textbooks || textbooks.length === 0) {
        return (
            <Text c="dimmed" ta="center">No textbooks found</Text>
        );
    }

    return (
        <Group wrap={displayMode === 'horizontal' ? 'nowrap' : 'wrap'}>
            {textbooks.sort((a, b) => 
                new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime()
            ).map((textbook) => {
                const isExpanded = expandedTextbooks.has(textbook.id);
                const textbookChapters = chapters?.[textbook.id] || [];
                
                if (textbook.parse_status !== "complete") {
                    return (
                        <Card 
                            withBorder 
                            key={textbook.id}
                            style={{ 
                                width: displayMode === 'horizontal' ? '300px' : '100%',
                                flexShrink: 0
                            }}
                        >
                            <Group align="flex-start" justify="space-between">
                                <Group align="flex-start">
                                    <Image
                                        src={getTextbookImage(textbook.id)}
                                        alt={`First page of ${textbook.title}`}
                                        width={150}
                                        height={150}
                                        style={{ objectFit: "contain", borderRadius: "10px" }}
                                    />
                                    <Stack gap="xs">
                                        <Text size="lg" fw={500}>{textbook.title}</Text>
                                        <Text size="sm" c="dimmed">
                                            {textbook.parse_status === 'parsing' ? 'Parsing...' :
                                                textbook.parse_status === 'extracting' ? 'Extracting content...' :
                                                textbook.parse_status === 'uploading' ? 'Uploading content...' :
                                                textbook.parse_status === 'error' ? 'Parse failed' :
                                                textbook.parse_status === 'idle' ? 'Waiting to parse' :
                                                'Could not find any topics.'}
                                        </Text>
                                        {textbook.parse_error && (
                                            <Text size="sm" c="red">
                                                Error: {textbook.parse_error}
                                            </Text>
                                        )}
                                        <Progress
                                            value={getTextbookProgress(textbook.id, textbook.parse_status !== 'parsing')}
                                            size="sm"
                                            color="blue"
                                            animated={['parsing', 'extracting', 'uploading'].includes(textbook.parse_status)}
                                            striped={['parsing', 'extracting', 'uploading'].includes(textbook.parse_status)}
                                        />
                                        {(['parsing', 'extracting', 'uploading'].includes(textbook.parse_status)) && (
                                            <Text size="sm" c="dimmed">
                                                Estimated time remaining: ~{getTextbookEstimatedTime(textbook.id, textbook.parse_status !== 'parsing')} seconds
                                            </Text>
                                        )}
                                    </Stack>
                                </Group>
                                <Button
                                    variant="light"
                                    color="blue"
                                    onClick={() => handleRetryTextbook(classId, textbook)}
                                    leftSection={<IconRefresh size={16} />}
                                    disabled={['parsing', 'extracting', 'uploading', 'idle'].includes(textbook.parse_status)}
                                    loading={parsingTextbooks.has(textbook.id)}
                                >
                                    {parsingTextbooks.has(textbook.id) ? 'Retrying...' :
                                        textbook.parse_status === 'parsing' ? 'Parsing...' :
                                        textbook.parse_status === 'extracting' ? 'Extracting...' :
                                        textbook.parse_status === 'uploading' ? 'Uploading...' :
                                        textbook.parse_status === 'error' ? 'Retry Parse' :
                                        'Processing...'}
                                </Button>
                            </Group>
                        </Card>
                    );
                }
                
                return (
                    <Stack key={textbook.id} gap={0} style={{ width: displayMode === 'horizontal' ? '300px' : '100%', flexShrink: 0 }}>
                        <Card 
                            withBorder 
                            style={{ cursor: 'pointer' }}
                            onClick={() => toggleTextbookExpansion(textbook.id)}
                        >
                            <Group align="flex-start" justify="space-between">
                                <Group align="flex-start">
                                    <Image
                                        src={getTextbookImage(textbook.id)}
                                        alt={`First page of ${textbook.title}`}
                                        width={150}
                                        height={150}
                                        style={{ objectFit: "contain", borderRadius: "10px" }}
                                    />
                                    <Stack gap="xs">
                                        <Text size="lg" fw={500}>{textbook.title}</Text>
                                        <Text size="sm" c="dimmed">
                                            Uploaded {new Date(textbook.created_at ?? "").toLocaleDateString()}
                                        </Text>
                                        <Text size="sm" c="dimmed">
                                            {textbookChapters.length} chapters
                                        </Text>
                                    </Stack>
                                </Group>
                                {isExpanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
                            </Group>
                        </Card>
                        
                        <Collapse in={isExpanded}>
                            <Stack gap="xs" p="md" style={{ borderLeft: '1px solid #e9ecef', borderRight: '1px solid #e9ecef', borderBottom: '1px solid #e9ecef', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                                {textbookChapters.length === 0 ? (
                                    <Text c="dimmed" ta="center">No chapters found</Text>
                                ) : (
                                    textbookChapters
                                        .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0))
                                        .map((chapter) => (
                                            <Link
                                                key={chapter.id}
                                                href={`/classes/c/${classId}/textbook/${textbook.id}/chapter/${chapter.id}`}
                                                style={{ textDecoration: 'none', color: 'inherit' }}
                                            >
                                                <Card withBorder>
                                                    <Group align="flex-start">
                                                        <Image
                                                            src={getChapterImage(textbook.id, chapter.id)}
                                                            alt={`Chapter ${chapter.chapter_number}`}
                                                            width={100}
                                                            height={100}
                                                            style={{ objectFit: "contain", borderRadius: "10px" }}
                                                        />
                                                        <Stack gap="xs">
                                                            <Text size="md" fw={500}>{chapter.title}</Text>
                                                            <Text size="sm" c="dimmed">
                                                                Chapter {chapter.chapter_number}
                                                            </Text>
                                                        </Stack>
                                                    </Group>
                                                </Card>
                                            </Link>
                                        ))
                                )}
                            </Stack>
                        </Collapse>
                    </Stack>
                );
            })}
        </Group>
    );
}