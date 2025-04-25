/**
 * ContextBadges.tsx
 * Used to show the context badges in the chat.
 */

import { Badge, Group, Avatar, Text, ActionIcon, Box, Tooltip, Progress } from "@mantine/core";
import { IconFile, IconPlus, IconWand, IconX } from "@tabler/icons-react";
import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { ChatMessage, ViewerMode, File, Document, CONTENT_COLORS } from "@/types";
import { getPageRanges, handleDocumentClick } from "@/utils/chat/chat-helpers";
import { getFiles } from "@/utils/queries/get-files";
import { getFileDocuments } from "@/utils/queries/get-file-docs";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { RecordedVideo } from "./ChatCanvas";
interface ContextBadgesProps {
    activeChat: ChatMessage;
    classId: string;
    onRemoveFile?: (fileId: string) => void;
    onRemoveDocument?: (documentId: string) => void;
    setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>;
}

export const ContextBadges = memo(({
    activeChat,
    classId,
    onRemoveFile,
    onRemoveDocument,
    setViewerMode,
}: ContextBadgesProps) => {
    const supabase = useSupabaseBrowser();

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: files, isLoading: loadingFiles } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, classId!),
        enabled: !!profile
    });

    const { data: fileDocuments } = useQuery({
        queryKey: ["fileDocuments", classId],
        queryFn: () => getFileDocuments(supabase, files!.map(f => f.id)),
        enabled: !!files
    });

    const renderFileBadge = (file: File | undefined, showPreview: boolean) => {
        if (!file) return null;
        const fileId = file.id;
        const fileDocument = fileDocuments?.filter(d => d.file === fileId).sort((a, b) => a.page - b.page)[0];

        // Check if this is a video file (starts with "video-")
        const isProcessingVideo = file.id.startsWith('video-') &&
            ['extracting', 'uploading', 'processing'].includes(file.parse_status || '');

        // Display title - show processing state for videos
        const displayTitle = isProcessingVideo
            ? `Video (${file.parse_status || 'processing'}...)`
            : file.title;

        return file && (
            <Badge
                key={fileId}
                color={CONTENT_COLORS[file.content_type]}
                style={{ cursor: 'pointer' }}
                leftSection={
                    showPreview ? <Avatar
                        src={`${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${fileId}/${fileDocument?.id}.png`}
                        size="xs"
                        radius="sm"
                    /> : <IconFile size={14} />
                }
                rightSection={onRemoveFile && (
                    <Tooltip label={`Remove from chat`} openDelay={500}>
                        <ActionIcon
                            variant="transparent"
                            color="white"
                            size={"sm"}
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemoveFile(fileId);
                            }}
                        >
                            <IconX size={16} />
                        </ActionIcon>
                    </Tooltip>
                )}
                onClick={(e) => {
                    if (setViewerMode && fileDocument?.id) {
                        handleDocumentClick(fileId, fileDocument.id, setViewerMode, false);
                    }
                }}
            >
                <Tooltip label={`Open in viewer`} openDelay={500} offset={8}>
                    <div>{displayTitle}</div>
                </Tooltip>
            </Badge>
        )
    }

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

    const renderDocumentBadges = (documentIds: string[]) => {
        const documents = documentIds.map(id => fileDocuments?.find(doc => doc.id === id)).filter(doc => doc !== undefined)
        const groupFiles = Array.from(new Set(documents.filter(doc => doc && doc.file !== null).map(doc => doc.file).filter((fileId) => fileId !== null)))
        // get the page ranges for each lecture and chapter
        const filePageRanges = groupFiles.map(file => getPageRanges(documents.filter(doc => doc && doc.file === file))).flat()
        // combine the page ranges for each lecture and chapter
        const allDocumentPageRanges = [...filePageRanges]

        return (
            <>
                {allDocumentPageRanges.length > 0 && allDocumentPageRanges.map((pageRange, pageRangeIndex) => {
                    const label = getDocumentLabel(
                        pageRange.startDocument ?? undefined,
                        pageRange.range
                    );
                    const file = files?.find(f => f.id === pageRange.startDocument?.file);
                    return file && pageRange.startDocument && (
                        <Badge
                            key={pageRange.startDocument.id}
                            color={CONTENT_COLORS[file.content_type]}
                            style={{ cursor: 'pointer' }}
                            leftSection={
                                <Avatar
                                    src={`${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${file.id}/${pageRange.startDocument.id}.png`}
                                    size="xs"
                                    radius="sm"
                                />
                            }
                            rightSection={onRemoveDocument && (
                                <Tooltip label={`Remove from chat`} openDelay={500}>
                                    <ActionIcon
                                        variant="transparent"
                                        color="white"
                                        size={"sm"}
                                        style={{ cursor: 'pointer' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // remove all the documents in the page range. Starting with the first document and until the last document.
                                            const firstPageNumber = pageRange.startDocument?.page ?? 0;
                                            const lastPageNumber = pageRange.endDocument?.page ?? 0;
                                            const documentsInRange = fileDocuments?.filter(doc => doc.page >= firstPageNumber && doc.page <= lastPageNumber);
                                            documentsInRange?.forEach(doc => {
                                                onRemoveDocument(doc.id);
                                            })
                                        }}
                                    >
                                        <IconX size={16} />
                                    </ActionIcon>
                                </Tooltip>
                            )}
                            onClick={(e) => {
                                if (setViewerMode && pageRange.startDocument?.id) {
                                    handleDocumentClick(file.id, pageRange.startDocument.id, setViewerMode, true);
                                }
                            }}
                        >
                            <Tooltip label={`View page details`} openDelay={500} offset={8}>
                                <div>{label}</div>
                            </Tooltip>
                        </Badge>
                    );
                })}
            </>
        )
    }

    return (
        <Group gap={"xs"} pb={"sm"} pt={"sm"}>
            {activeChat.files.map(fileId => renderFileBadge(files?.find(f => f.id === fileId), true))}
            {renderDocumentBadges(activeChat.documents)}
        </Group>
    )
});

ContextBadges.displayName = 'ContextBadges';

