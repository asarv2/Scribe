/**
 * app/classes/[classId]/textbook/[textbookId]/page.tsx
 * The page for a specific textbook in a class.
 * @AshokSaravanan222
 * 11.11.2024
 */
"use client"

import { Chapter } from '@/types';
import { getChapters } from '@/utils/queries/get-chapters';
import { getDocumentsTextbook } from '@/utils/queries/get-documents-textbook';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { Card, Group, Stack, Text, Container, Flex, Button, useMantineColorScheme, Skeleton, Box } from '@mantine/core';
import { IconArrowLeft, IconPencil } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClassLayout } from '@/components/Class/ClassLayout';

function ChapterSkeleton() {
    return (
        <Card withBorder>
            <Group align="flex-start">
                <Skeleton height={150} width={150} radius="md" />
                <Stack gap="xs">
                    <Skeleton height={24} width={200} />
                    <Skeleton height={16} width={150} />
                </Stack>
            </Group>
        </Card>
    );
}

export default function Textbook({ params }: { params: { classId: string, textbookId: string } }) {
    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const textbookId = params.textbookId;

    const { colorScheme } = useMantineColorScheme();

    const { data: chapters } = useQuery({
        queryKey: ['chapters'],
        queryFn: () => getChapters(supabase, [textbookId])
    })

    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getDocumentsTextbook(supabase, [textbookId]),
    })

    const getChapterImage = (chapterId: string) => {
        const chapter = chapters?.find(chapter => chapter.id === chapterId);
        if (!chapter) return '/placeholder_image.svg';
        const filteredDocuments = documents?.filter(document => document.page >= chapter.start_page && document.page <= chapter.end_page);
        if (!filteredDocuments) return '/placeholder_image.svg';
        const document = filteredDocuments[0];
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${textbookId}/${document.id}.png`
    }

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            {/* <Link href={`/classes/${classId}/textbook`}>
                                <IconArrowLeft size={24} color={colorScheme === "dark" ? "white" : "black"} style={{ cursor: "pointer" }} />
                            </Link> */}
                            <Text size="xl" fw={700} mb={6} pl={4}>Chapters</Text>
                        </Group>
                    </Flex>
                    <Stack>
                        {loadingDocuments ? (
                            // Show 3 skeleton chapters while loading
                            [...Array(3)].map((_, index) => (
                                <ChapterSkeleton key={index} />
                            ))
                        ) : (
                            chapters && chapters.map((chapter) => (
                                <Card withBorder key={chapter.id}>
                                    <Box pos="relative">
                                        <Link 
                                            href={`/classes/c/${classId}/textbook/${textbookId}/exercises/${chapter.id}`}
                                            style={{ 
                                                position: 'absolute', 
                                                top: 8,
                                                right: 8,
                                                zIndex: 2,
                                                textDecoration: 'none'
                                            }}
                                        >
                                            <Button
                                                variant="light"
                                                size="sm"
                                                leftSection={<IconPencil size={16} />}
                                                radius="md"
                                            >
                                                Exercises
                                            </Button>
                                        </Link>
                                        <Link
                                            href={`/classes/c/${classId}/textbook/${textbookId}/chapter/${chapter.id}`}
                                            style={{ textDecoration: 'none' }}
                                        >
                                            <Group align="flex-start">
                                                <Image
                                                    src={getChapterImage(chapter.id)}
                                                    alt={`Page ${chapter.chapter_number}`}
                                                    width={150}
                                                    height={150}
                                                    style={{ objectFit: "contain", borderRadius: "10px" }}
                                                />
                                                <Stack gap="xs">
                                                    <Text size="lg" fw={500}>{chapter.title}</Text>
                                                    <Text size="sm" c="dimmed">
                                                        Chapter {chapter.chapter_number}
                                                    </Text>
                                                </Stack>
                                            </Group>
                                        </Link>
                                    </Box>
                                </Card>
                            ))
                        )}
                    </Stack>
                </Stack>
            </Container>
        </ClassLayout>
    );
}