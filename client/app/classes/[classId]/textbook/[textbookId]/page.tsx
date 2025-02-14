/**
 * app/classes/[classId]/textbook/[textbookId]/page.tsx
 * The page for a specific textbook in a class.
 * @AshokSaravanan222
 * 11.11.2024
 */
"use client"

import { HeaderSimple } from '@/components/HeaderSimple';
import { Chapter } from '@/types';
import { getChapters } from '@/utils/queries/get-chapters';
import { getDocumentsTextbook } from '@/utils/queries/get-documents-textbook';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { Card, Group, Stack, Text, Container, Flex, Button, useMantineColorScheme } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

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
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Link href={`/classes/${classId}/textbook`}>
                                <IconArrowLeft size={24} color={colorScheme === "dark" ? "white" : "black"} style={{ cursor: "pointer" }} />
                            </Link>
                            <Text size="xl" fw={700} mb={6} pl={4}>Chapters</Text>
                        </Group>
                    </Flex>
                    <Stack>
                        {chapters && chapters.map((chapter) => (
                            <Link
                                href={`/classes/${classId}/textbook/${textbookId}/chapter/${chapter.id}`}
                                key={chapter.id}
                                style={{ textDecoration: 'none' }}
                            >
                                <Card withBorder>
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
                                </Card>
                            </Link>
                        ))}
                    </Stack>
                </Stack>
            </Container>
        </>
    );
}