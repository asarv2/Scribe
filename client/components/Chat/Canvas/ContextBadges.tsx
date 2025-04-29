/**
 * ContextBadges.tsx
 * Used to show the context badges in the chat.
 */

import { Group } from "@mantine/core";
import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { ChatMessage, ViewerMode, File, Document, CONTENT_COLORS } from "@/types";
import { getPageRanges, handleDocumentClick } from "@/utils/chat/chat-helpers";
import { getFiles } from "@/utils/queries/get-files";
import { getFileDocuments } from "@/utils/queries/get-file-docs";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import ItemCard from "../ItemCard";

interface ContextBadgesProps {
    activeChat: ChatMessage;
    classId: string;
    onRemoveFile?: (fileId: string) => void;
    onRemoveDocument?: (documentId: string) => void;
    setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>;
    modePopoverOpened?: boolean; // Add this new prop
}

export const ContextBadges = memo(({
    activeChat,
    classId,
    onRemoveFile,
    onRemoveDocument,
    setViewerMode,
    modePopoverOpened = false, // Default to false
}: ContextBadgesProps) => {
    const supabase = useSupabaseBrowser();

    const { data: files } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, classId!),
    });

    const { data: fileDocuments } = useQuery({
        queryKey: ["fileDocuments", classId],
        queryFn: () => getFileDocuments(supabase, files!.map(f => f.id)),
        enabled: !!files
    });

    return (
        <Group
            gap={"xs"}
            pb={"sm"}
            pt={"sm"}
            style={{
                flexWrap: "wrap",
                justifyContent: "flex-start", // Align badges to the start
                alignItems: "center", // Align badges vertically
                paddingLeft: modePopoverOpened ? '160px' : '0px', // Add left padding when popover is open
                transition: 'padding-left 0.2s ease', // Smooth transition for movement
                borderBottom: 'none', // Ensure no bottom border
                borderTop: 'none' // Ensure no top border
            }}
        >
            {activeChat.files.map(fileId => {
                const file = files?.find(f => f.id === fileId);
                return file && (
                    <div
                        key={fileId}
                        style={{
                            display: "inline-flex", // Ensure each badge behaves like an inline element
                            width: "auto", // Dynamically adjust width based on content
                            maxWidth: "100%", // Prevent overflow
                        }}
                    >
                        <ItemCard
                            item={{
                                ...file,
                                newName: file.title,
                                imageUrl: `${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${file.id}/${fileDocuments?.find(d => d.file === file.id)?.id}.png`,
                            }}
                            classId={classId}
                            profileId={""} // Not needed for badges
                            color={CONTENT_COLORS[file.content_type ?? "other"]}
                            contextType={file.content_type ?? "other"}
                            addFileToChat={() => {}} // No-op for badges
                            isVisible={true}
                            makeDraggable={false}
                            setViewerMode={setViewerMode}
                            fileDocuments={fileDocuments}
                            onFileDelete={onRemoveFile ? () => onRemoveFile(fileId) : undefined}
                        />
                    </div>
                );
            })}
            {activeChat.documents.map(documentId => {
                const document = fileDocuments?.find(d => d.id === documentId);
                const file = files?.find(f => f.id === document?.file);
                return file && document && (
                    <div
                        key={documentId}
                        style={{
                            display: "inline-flex", // Ensure each badge behaves like an inline element
                            width: "auto", // Dynamically adjust width based on content
                            maxWidth: "100%", // Prevent overflow
                        }}
                    >
                        <ItemCard
                            item={{
                                ...file,
                                newName: `${file.title} p.${document.page}`,
                                imageUrl: `${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${file.id}/${document.id}.png`,
                            }}
                            classId={classId}
                            profileId={""} // Not needed for badges
                            color={CONTENT_COLORS[file.content_type ?? "other"]}
                            contextType={file.content_type ?? "other"}
                            addFileToChat={() => {}} // No-op for badges
                            isVisible={true}
                            makeDraggable={false}
                            setViewerMode={setViewerMode}
                            fileDocuments={fileDocuments}
                            onFileDelete={onRemoveDocument ? () => onRemoveDocument(documentId) : undefined}
                        />
                    </div>
                );
            })}
        </Group>
    );
});

ContextBadges.displayName = 'ContextBadges';

