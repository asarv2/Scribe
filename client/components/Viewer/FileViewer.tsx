/**
 * FileViewer.tsx
 * 
 * This component is used to display the file viewer for the file page.
 * @AshokSaravanan222
 * 02.05.2025
 */
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getClass } from "@/utils/queries/get-class";;
import { useSearchParams } from "next/navigation";
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Stack, Text, useMantineColorScheme, Skeleton, Modal } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Flex } from "@mantine/core";
import Latex from "@/components/Latex";
import { getFileDocuments } from "@/utils/queries/get-file-docs";
import { getFile } from "@/utils/queries/get-file";

type FileViewerProps = {
    classId: string;
    fileId: string;
    initialDocumentId?: string;
}

export default function FileViewer({
    classId,
    fileId,
    initialDocumentId,
}: FileViewerProps) {
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
    const previewScrollRef = useRef<HTMLDivElement>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    const supabase = useSupabaseBrowser();

    const searchParams = useSearchParams();
    const page = searchParams.get("page");

    const handlePageClick = (newDocumentId: string) => {
        setActiveDocumentId(newDocumentId);
    };

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["fileDocuments", fileId],
        queryFn: () => getFileDocuments(supabase, [fileId])
    })

    const { data: file, isLoading: loadingFile } = useQuery({
        queryKey: ["file", fileId],
        queryFn: () => getFile(supabase, fileId)
    })

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const getActiveImage = (documentId: string | null) => {
        if (!classData || !file || !documentId) return "/placeholder_image.svg";
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${fileId}/${documentId}.png`;
    }

    const handleSwipe = (touchEndX: number) => {
        if (touchStartX !== null && documents) {
            const deltaX = touchStartX - touchEndX;
            const minSwipeDistance = 50;

            const currentIndex = documents.findIndex(doc => doc.id === activeDocumentId);
            if (deltaX > minSwipeDistance && currentIndex < documents.length - 1) {
                // Swipe left (next page)
                handlePageClick(documents[currentIndex + 1].id);
            } else if (deltaX < -minSwipeDistance && currentIndex > 0) {
                // Swipe right (previous page)
                handlePageClick(documents[currentIndex - 1].id);
            }
        }
        setTouchStartX(null);
    };

    useEffect(() => {
        if (documents && documents.length > 0 && !activeDocumentId) {
            if (initialDocumentId) {
                setActiveDocumentId(initialDocumentId);
            } else if (page) {
                // Handle both single page numbers and page ranges (e.g., "p.5" or "pp.5-7")
                const pageNum = parseInt(page.replace(/[^0-9]/g, ''));
                const matchingDoc = documents.find(doc => doc.page === pageNum);
                if (matchingDoc) {
                    setActiveDocumentId(matchingDoc.id);
                } else {
                    // Default to first page if specified page not found
                    setActiveDocumentId(documents[0].id);
                }
            } else {
                // No page specified, default to first page
                setActiveDocumentId(documents[0].id);
            }
        }
    }, [documents, activeDocumentId, page, initialDocumentId]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!documents) return;
            const currentIndex = documents.findIndex(doc => doc.id === activeDocumentId);

            if (event.key === 'ArrowLeft' && currentIndex > 0) {
                handlePageClick(documents[currentIndex - 1].id);
            } else if (event.key === 'ArrowRight' && currentIndex < documents.length - 1) {
                handlePageClick(documents[currentIndex + 1].id);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeDocumentId, documents]);

    useEffect(() => {
        if (previewScrollRef.current) {
            const activeThumb = previewScrollRef.current.querySelector(`[data-document="${activeDocumentId}"]`);
            if (activeThumb) {
                activeThumb.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }
    }, [activeDocumentId]);

    // Add function to open the full-size image modal
    const openImageModal = () => {
        setIsImageModalOpen(true);
    };

    return (
        <>
            <Stack gap="xs" style={{ height: '100%' }}>
                {loadingDocuments ? (
                    // Skeleton for embedded viewer
                    <Box style={{
                        position: 'relative',
                        width: '100%',
                        aspectRatio: '16/9',
                        borderRadius: "10px",
                        flexShrink: 0
                    }}>
                        <Skeleton height="100%" width="100%" radius="md" />
                    </Box>
                ) : (
                    <Box style={{
                        position: 'relative',
                        width: '100%',
                        aspectRatio: '16/9',
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "10px",
                        flexShrink: 0
                    }}
                        onTouchStart={(e) => {
                            setTouchStartX(e.changedTouches[0].clientX);
                        }}
                        onTouchEnd={(e) => {
                            const touchEndX = e.changedTouches[0].clientX;
                            handleSwipe(touchEndX);
                        }}
                    >
                        <Image
                            src={getActiveImage(activeDocumentId)}
                            alt={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`}
                            width={500}
                            height={500}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: "contain",
                                cursor: "zoom-in" // Add cursor to indicate clickable
                            }}
                            sizes="100vw"
                            placeholder="blur"
                            blurDataURL={"/placeholder_image.svg"}
                            onClick={openImageModal} // Add click handler to open modal
                        />
                        <ActionIcon
                            size={"lg"}
                            variant="filled"
                            color="gray"
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: 5,
                                transform: 'translateY(-50%)',
                                zIndex: 100,
                            }}
                            onClick={() => {
                                const currentIndex = documents?.findIndex(doc => doc.id === activeDocumentId) ?? 0;
                                if (currentIndex > 0 && documents) {
                                    handlePageClick(documents[currentIndex - 1].id);
                                }
                            }}
                            disabled={!documents || documents.findIndex(doc => doc.id === activeDocumentId) === 0}
                            aria-label="Previous Slide"
                        >
                            <IconArrowLeft size={24} />
                        </ActionIcon>
                        <ActionIcon
                            size={"lg"}
                            variant="filled"
                            color="gray"
                            style={{
                                position: 'absolute',
                                top: '50%',
                                right: 5,
                                transform: 'translateY(-50%)',
                                zIndex: 100,
                            }}
                            onClick={() => {
                                const currentIndex = documents?.findIndex(doc => doc.id === activeDocumentId) ?? 0;
                                if (documents && currentIndex < documents.length - 1) {
                                    handlePageClick(documents[currentIndex + 1].id);
                                }
                            }}
                            disabled={!documents || documents.findIndex(doc => doc.id === activeDocumentId) === documents.length - 1}
                            aria-label="Next Slide"
                        >
                            <IconArrowRight size={24} />
                        </ActionIcon>
                        <Box
                            pos="absolute"
                            bottom={5}
                            right={5}
                            p={4}
                            style={{
                                zIndex: 100,
                                backgroundColor: "rgba(0,0,0,0.7)",
                                borderRadius: "4px",
                            }}
                        >
                            <Text
                                size={"xs"}
                                fw={500}
                                style={{
                                    color: "white",
                                    textShadow: "0px 0px 4px rgba(0,0,0,0.5)"
                                }}
                            >
                                Page {documents?.find(doc => doc.id === activeDocumentId)?.page}
                            </Text>
                        </Box>
                    </Box>
                )}

                {/* Preview strip with fixed height and better visibility */}
                <Box
                    style={{
                        flexShrink: 0,
                        height: '40px', // Fixed height
                        marginBottom: '4px' // Add some space between preview and description
                    }}
                >
                    {loadingDocuments ? (
                        <Flex gap={4} style={{ padding: '2px', height: '100%' }}>
                            {[...Array(6)].map((_, index) => (
                                <Skeleton key={index} height={35} width={35} radius="sm" />
                            ))}
                        </Flex>
                    ) : (
                        <Flex
                            ref={previewScrollRef}
                            gap={4}
                            style={{
                                overflowX: 'auto',
                                padding: '2px',
                                height: '100%',
                                width: '100%'
                            }}
                        >
                            {documents?.map((doc) => (
                                <Box
                                    key={doc.id}
                                    data-document={doc.id}
                                    style={{
                                        cursor: 'pointer',
                                        width: 35, // Slightly smaller
                                        height: 35, // Slightly smaller
                                        position: 'relative',
                                        flexShrink: 0,
                                        borderRadius: '4px',
                                        overflow: 'hidden',
                                    }}
                                    onClick={() => handlePageClick(doc.id)}
                                >
                                    <Image
                                        src={getActiveImage(doc.id)}
                                        alt={`Page ${doc.page}`}
                                        width={35}
                                        height={35}
                                        style={{
                                            objectFit: 'cover',
                                            outline: doc.id === activeDocumentId ? '2px solid skyblue' : 'none',
                                            outlineOffset: '-2px',
                                        }}
                                        sizes="100vw"
                                    />
                                </Box>
                            ))}
                        </Flex>
                    )}
                </Box>

                {/* Description with flex-grow to take remaining space */}
                <Box style={{
                    overflow: 'auto',
                    paddingInline: '2px',
                    flexGrow: 1,
                    minHeight: '80px' // Ensure description always has some minimum height
                }}>
                    {loadingDocuments ? (
                        <Stack>
                            <Skeleton height={16} width="90%" />
                            <Skeleton height={16} width="85%" />
                            <Skeleton height={16} width="70%" />
                        </Stack>
                    ) : (
                        <Text fw={500} size="sm">
                            <Latex>{documents?.find((doc) => doc.id === activeDocumentId)?.description ?? ""}</Latex>
                        </Text>
                    )}
                </Box>
            </Stack>
            {/* Add the full-size image modal */}
            <Modal
                opened={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                size="xl"
                padding="md"
                centered
                title={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`}
            >
                <Box
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '80vh'
                    }}
                >
                    <Image
                        src={getActiveImage(activeDocumentId)}
                        alt={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`}
                        width={1200}
                        height={1200}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: "contain"
                        }}
                        sizes="100vw"
                    />
                </Box>
            </Modal>
        </>
    );

}