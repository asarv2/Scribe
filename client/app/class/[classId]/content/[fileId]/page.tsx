/**
 * app/class/[classId]/content/[fileId]/page.tsx
 * The page for viewing a specific file in a class.
 * @AshokSaravanan222
 * 11.11.2024
 */
"use client"
import Viewer from "@/components/Viewer/Viewer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getClass } from "@/utils/queries/get-class";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useState, useEffect, useMemo, useRef, use } from "react";
import { getAllChats } from "@/utils/queries/get-all-chats";
import { getMessages } from "@/utils/queries/get-messages";
import { Tabs, TextInput, Button, Group, Card, Stack, Text, Badge, Accordion, ActionIcon, Modal, Box, Container, Flex, Grid, Skeleton, Textarea, Divider } from "@mantine/core";
import { IconMessage, IconSettings, IconRuler, IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { useDisclosure, useIntersection } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { DateTimePicker } from '@mantine/dates';
import { useMantineColorScheme } from "@mantine/core";
import Image from "next/image";
import Latex from "@/components/Latex";
import { ClassLayout } from "@/components/Class/ClassLayout";
import navigationStyles from '@/components/Viewer/NavigationControls.module.css';
import { getFileDocuments } from "@/utils/queries/get-file-docs";
import { getFile } from "@/utils/queries/get-file";
import DeleteFileModal from "@/components/Delete/DeleteFileModal";
import { updateFileDate, updateFileInfo, updateFileName } from "@/utils/services/file";

type FileViewerProps = {
    params: Promise<{
        classId: string;
        fileId: string;
    }>
}

export default function FileViewer({ params }: FileViewerProps) {
    const { classId, fileId } = use(params);
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [fileDate, setFileDate] = useState<Date | null>(null);
    const [isNameUpdating, setIsNameUpdating] = useState(false);
    const [isDateUpdating, setIsDateUpdating] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [touchStartX, setTouchStartX] = useState(0);
    const previewScrollRef = useRef<HTMLDivElement>(null);
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const [isImageLoading, setIsImageLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("chats");
    const [aiInstructions, setAiInstructions] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();

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

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: chats, isLoading: loadingChats } = useQuery({
        queryKey: ["allChats", classId],
        queryFn: () => getAllChats(supabase, classId),
    });

    const { data: messages, isLoading: loadingMessages } = useQuery({
        queryKey: ["messages", classId, chats],
        queryFn: () => getMessages(supabase, chats ? chats.map(chat => chat.id) : []),
        enabled: !!chats
    });

    const handleUpdateFileName = async () => {
        if (!fileName.trim()) return;

        try {
            setIsNameUpdating(true);
            await updateFileName(fileId, fileName);
            queryClient.invalidateQueries({ queryKey: ["file", fileId] });
            notifications.show({
                title: "File updated",
                message: "File name has been updated successfully",
                color: "green"
            });
        } catch (error) {
            notifications.show({
                title: "Error",
                message: "Failed to update file name",
                color: "red"
            });
        } finally {
            setIsNameUpdating(false);
        }
    };

    const handleUpdateFileDate = async () => {
        if (!fileDate) return;

        try {
            setIsDateUpdating(true);
            await updateFileDate(fileId, fileDate.toISOString());
            queryClient.invalidateQueries({ queryKey: ["file", fileId] });
            notifications.show({
                title: "File updated",
                message: "File date has been updated successfully",
                color: "green"
            });
        } catch (error) {
            notifications.show({
                title: "Error",
                message: "Failed to update file date",
                color: "red"
            });
        } finally {
            setIsDateUpdating(false);
        }
    };

    const handleSaveAiInstructions = async () => {
        try {
            setLoading(true);
            const { success, error } = await updateFileInfo(fileId, aiInstructions);
            if (success) {
                queryClient.invalidateQueries({ queryKey: ["file", fileId] });
                notifications.show({
                    title: "AI Instructions saved",
                    message: "AI Instructions saved successfully",
                    color: "green"
                })
            } else {
                throw new Error(error);
            }
        } catch (error) {
            notifications.show({
                title: "Failed to save AI Instructions",
                message: "Failed to save AI Instructions",
                color: "red"
            })
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (file) {
            setFileName(file.title || "");
            setFileDate(file.file_date ? new Date(file.file_date) : null);
            setAiInstructions(file.additional_info || "");
        }
    }, [file]);

    const getActiveImage = (documentId: string | null) => {
        if (!classData || !file || !documentId) return "/placeholder_image.svg";
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${fileId}/${documentId}.png`;
    }

    const images = documents?.map(doc => ({
        id: doc.id,
        src: getActiveImage(doc.id),
        alt: `Page ${doc.page}`,
        label: `Page ${doc.page}`
    })) || [];

    useEffect(() => {
        if (documents && documents.length > 0) {
            setActiveDocumentId(documents[0].id);
        }
    }, [documents]);

    const handleSwipe = (touchEndX: number) => {
        const swipeDistance = touchEndX - touchStartX;
        const currentIndex = images.findIndex(img => img.id === activeDocumentId);

        if (Math.abs(swipeDistance) > 50) {
            if (swipeDistance > 0 && currentIndex > 0) {
                setActiveDocumentId(images[currentIndex - 1].id);
            } else if (swipeDistance < 0 && currentIndex < images.length - 1) {
                setActiveDocumentId(images[currentIndex + 1].id);
            }
        }
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const currentIndex = images.findIndex(img => img.id === activeDocumentId);
            if (event.key === 'ArrowLeft' && currentIndex > 0) {
                setActiveDocumentId(images[currentIndex - 1].id);
            } else if (event.key === 'ArrowRight' && currentIndex < images.length - 1) {
                setActiveDocumentId(images[currentIndex + 1].id);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeDocumentId, images]);

    useEffect(() => {
        if (previewScrollRef.current) {
            const activeThumb = previewScrollRef.current.querySelector(`[data-image="${activeDocumentId}"]`);
            activeThumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [activeDocumentId]);

    const MainViewer = () => {
        const currentImage = images.find(img => img.id === activeDocumentId);

        return (
            <Card padding="md" pos="relative" withBorder>
                <Box style={{
                    position: 'relative',
                    width: '100%',
                    height: 500,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "10px",
                    flexShrink: 0
                }}
                    onTouchStart={(e) => setTouchStartX(e.changedTouches[0].clientX)}
                    onTouchEnd={(e) => handleSwipe(e.changedTouches[0].clientX)}
                >
                    {isImageLoading && (
                        <Skeleton height="100%" width="100%" radius="md" />
                    )}
                    <Image
                        src={currentImage?.src || "/placeholder_image.svg"}
                        alt={currentImage?.alt || ""}
                        width={500}
                        height={500}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: "contain",
                            cursor: "zoom-in",
                            opacity: isImageLoading ? 0 : 1,
                            transition: 'opacity 0.2s ease-in-out',
                            borderRadius: "10px"
                        }}
                        sizes="100vw"
                        placeholder="blur"
                        blurDataURL="/placeholder_image.svg"
                        onClick={() => setIsImageModalOpen(true)}
                        onLoadingComplete={() => setIsImageLoading(false)}
                        onLoadStart={() => setIsImageLoading(true)}
                        priority
                    />

                    {/* Navigation arrows */}
                    <ActionIcon
                        size="lg"
                        variant="filled"
                        color="gray"
                        className={`${navigationStyles.navigationArrow} ${navigationStyles.leftArrow}`}
                        onClick={() => {
                            const currentIndex = images.findIndex(img => img.id === activeDocumentId);
                            if (currentIndex > 0) {
                                setActiveDocumentId(images[currentIndex - 1].id);
                            }
                        }}
                        disabled={images.findIndex(img => img.id === activeDocumentId) === 0}
                        aria-label="Previous Slide"
                    >
                        <IconArrowLeft size={24} />
                    </ActionIcon>
                    <ActionIcon
                        size="lg"
                        variant="filled"
                        color="gray"
                        className={`${navigationStyles.navigationArrow} ${navigationStyles.rightArrow}`}
                        onClick={() => {
                            const currentIndex = images.findIndex(img => img.id === activeDocumentId);
                            if (currentIndex < images.length - 1) {
                                setActiveDocumentId(images[currentIndex + 1].id);
                            }
                        }}
                        disabled={images.findIndex(img => img.id === activeDocumentId) === images.length - 1}
                        aria-label="Next Slide"
                    >
                        <IconArrowRight size={24} />
                    </ActionIcon>

                    <Box
                        className={navigationStyles.pageIndicator}
                    >
                        <Text
                            size="sm"
                            className={navigationStyles.pageText}
                        >
                            {currentImage?.label || ""}
                        </Text>
                    </Box>
                </Box>
            </Card>
        );
    };

    // Update the intersection observer settings
    const { ref: chatsIntersection, entry: chatsEntry } = useIntersection({
        root: null,
        threshold: 0.2,  // Lower threshold for earlier detection
        rootMargin: '-100px 0px'  // Trigger slightly before element comes into view
    });

    const { ref: settingsIntersection, entry: settingsEntry } = useIntersection({
        root: null,
        threshold: 0.2,
        rootMargin: '-100px 0px'
    });

    // Get content type label for display
    const getContentTypeLabel = () => {
        if (!file) return "File";
        
        const contentType = file.content_type || "file";
        return contentType.charAt(0).toUpperCase() + contentType.slice(1);
    };

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px", position: "relative" }}>
                <Stack gap="xs">
                    <Flex justify="space-between" align="center" w="100%">
                        <Group>
                            <Skeleton visible={loadingFile} height={32} width={loadingFile ? 300 : '100%'}>
                                <Text size="xl" fw={700} mb={6}>{file?.title}</Text>
                            </Skeleton>
                        </Group>
                        <Group>
                            <Skeleton visible={loadingFile} width={loadingFile ? 300 : '100%'}>
                                <DeleteFileModal fileId={fileId} fileName={file?.title ?? ""} profileId={profile?.id ?? ""} classId={classId} contentType={file?.content_type ?? "other"} />
                            </Skeleton>
                        </Group>
                    </Flex>
                    <Grid style={{ minHeight: '90vh' }}>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <Box style={{
                                position: isMobile ? 'relative' : 'sticky',
                                top: 80,
                                zIndex: 10,
                                height: 'calc(100vh - 40px)',
                                display: 'flex'
                            }}>
                                <Stack pos="relative" style={{ width: '100%' }}>
                                    {loadingDocuments ? (
                                        <>
                                            <Skeleton height={300} radius="md" />
                                            <Skeleton height={40} radius="sm" />
                                        </>
                                    ) : (
                                        <>
                                            <MainViewer />
                                            <Box style={{ flexShrink: 0, height: '40px', marginBottom: '4px' }}>
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
                                                    {images.map((img) => (
                                                        <Box
                                                            key={img.id}
                                                            data-image={img.id}
                                                            style={{
                                                                cursor: 'pointer',
                                                                width: 35,
                                                                height: 35,
                                                                position: 'relative',
                                                                flexShrink: 0,
                                                                borderRadius: '4px',
                                                                overflow: 'hidden',
                                                            }}
                                                            onClick={() => setActiveDocumentId(img.id)}
                                                        >
                                                            <Image
                                                                src={img.src}
                                                                alt={img.alt}
                                                                width={35}
                                                                height={35}
                                                                style={{
                                                                    objectFit: 'cover',
                                                                    outline: img.id === activeDocumentId ? '2px solid skyblue' : 'none',
                                                                    outlineOffset: '-2px',
                                                                }}
                                                                sizes="100vw"
                                                            />
                                                        </Box>
                                                    ))}
                                                </Flex>
                                            </Box>
                                        </>
                                    )}
                                </Stack>
                            </Box>
                        </Grid.Col>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <Box style={{
                                position: 'relative',
                                overflow: 'auto',
                                maxHeight: 'calc(100vh - 55px)'
                            }}>
                                <Stack style={{ paddingBottom: '20px' }}>

                                    <Box
                                        ref={settingsIntersection}
                                        style={{
                                            transition: 'transform 0.3s ease, opacity 0.3s ease',
                                            transform: settingsEntry?.isIntersecting ? 'translateY(0)' : 'translateY(20px)',
                                            opacity: settingsEntry?.isIntersecting ? 1 : 0.5,
                                        }}
                                    >
                                        <Skeleton visible={loadingFile}>
                                            <Stack gap="md">
                                                <Stack gap="xs">
                                                    <Text size="sm" fw={500}>{getContentTypeLabel()} Name</Text>
                                                    <Group justify="space-between">
                                                        <TextInput
                                                            value={fileName}
                                                            onChange={(e) => setFileName(e.currentTarget.value)}
                                                            placeholder="Enter file name"
                                                            style={{ flex: 1 }}
                                                        />
                                                        <Button
                                                            onClick={handleUpdateFileName}
                                                            loading={isNameUpdating}
                                                            disabled={!fileName.trim() || fileName === file?.title}
                                                        >
                                                            Save
                                                        </Button>
                                                    </Group>
                                                </Stack>

                                                <Stack gap="xs">
                                                    <Text size="sm" fw={500}>{getContentTypeLabel()} Time</Text>
                                                    <Group justify="space-between">
                                                        <DateTimePicker
                                                            placeholder="Select date and time"
                                                            valueFormat="DD MMM YYYY hh:mm A"
                                                            value={fileDate}
                                                            onChange={setFileDate}
                                                            style={{ flex: 1 }}
                                                        />
                                                        <Button
                                                            onClick={handleUpdateFileDate}
                                                            loading={isDateUpdating}
                                                            disabled={!fileDate || Boolean(file?.file_date && new Date(file.file_date).getTime() === fileDate.getTime())}
                                                        >
                                                            Save
                                                        </Button>
                                                    </Group>
                                                </Stack>

                                                <Stack gap="xs">
                                                    <Text size="sm" fw={500}>AI Instructions</Text>
                                                    <Group justify="space-between">
                                                        <Textarea
                                                            value={aiInstructions}
                                                            onChange={(event) => setAiInstructions(event.currentTarget.value)}
                                                            placeholder="Example: Focus on explaining the key concepts in simple terms"
                                                            autosize
                                                            minRows={3}
                                                            maxRows={5}
                                                            style={{ flex: 1 }}
                                                        />
                                                        <Button
                                                            onClick={handleSaveAiInstructions}
                                                            loading={loading}
                                                            disabled={aiInstructions === file?.additional_info}
                                                        >
                                                            Save
                                                        </Button>
                                                    </Group>
                                                </Stack>
                                            </Stack>
                                        </Skeleton>
                                    </Box>

                                    <Divider my="sm" />

                                    {!loadingDocuments && documents?.find(doc => doc.id === activeDocumentId)?.description && (
                                        <>
                                            <Box>
                                                <Text fw={700} mb="md">Page Description</Text>
                                                <Card withBorder p="md">
                                                    <Text fw={500} size="sm">
                                                        <Latex>{documents?.find(doc => doc.id === activeDocumentId)?.description ?? ""}</Latex>
                                                    </Text>
                                                </Card>
                                            </Box>
                                            <Divider my="sm" />
                                        </>
                                    )}
                                </Stack>
                            </Box>
                        </Grid.Col>
                    </Grid>
                </Stack>
            </Container>

            {/* Full-size image modal */}
            <Modal
                opened={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                size="xl"
                padding="md"
                centered
                title={images.find(img => img.id === activeDocumentId)?.label || ""}
            >
                <Box style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '80vh'
                }}>
                    <Image
                        src={images.find(img => img.id === activeDocumentId)?.src || "/placeholder_image.svg"}
                        alt={images.find(img => img.id === activeDocumentId)?.alt || ""}
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
        </ClassLayout>
    );
}