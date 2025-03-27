/**
 * app/classes/c/[classId]/content/page.tsx
 * This page will be an interactive page allowing the professor to view the content for the class, which includes lectures, textbooks (and their chapters in particular), and homework assignments.
 * @AshokSaravanan222
 * 03/06/2025
 * 
 */
"use client";

import { getHomeworks } from "@/utils/queries/get-homeworks";

import { useEffect } from "react";

import useSupabaseBrowser from "@/utils/supabase/supabase-browser";

import { use } from "react";
import { ClassLayout } from "@/components/Class/ClassLayout";
import Content from "@/components/Content/Content";
import { Container } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Homework, Lecture, Textbook } from "@/types";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";

export default function ContentPage({ params }: { params: Promise<{ classId: string }> }) {
    const { classId } = use(params);
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();

    // Lectures data
    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, [classId], false)
    });

    // Textbooks data
    const { data: textbooks, isLoading: loadingTextbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, [classId])
    });

    // Homework data
    const { data: homeworks, isLoading: loadingHomeworks } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, [classId])
    });

    // Add realtime subscriptions for lectures
    useEffect(() => {
        const channel = supabase
            .channel('realtime-lectures')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'lectures',
                    filter: `class=eq.${classId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newLecture = payload.new as Lecture;
                        queryClient.setQueryData(["lectures", classId], (oldData: Lecture[] | undefined) => {
                            return oldData ? [...oldData, newLecture] : [newLecture];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedLecture = payload.new as Lecture;
                        queryClient.setQueryData(["lectures", classId], (oldData: Lecture[] | undefined) => {
                            return oldData ? oldData.map(lecture =>
                                lecture.id === updatedLecture.id ? updatedLecture : lecture
                            ) : [updatedLecture];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, queryClient]);

    // Add realtime subscriptions for lecture documents
    useEffect(() => {
        if (!lectures || lectures.length === 0) return;

        const channel = supabase
            .channel('realtime-lecture-documents')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'documents',
                    filter: `lecture=in.(${lectures.map(lecture => lecture.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["lectureDocuments", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, lectures, queryClient]);

    // Add realtime subscriptions for textbooks
    useEffect(() => {
        const channel = supabase
            .channel('realtime-textbooks')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'textbooks',
                    filter: `class=eq.${classId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newTextbook = payload.new as Textbook;
                        queryClient.setQueryData(["textbooks", classId], (oldData: Textbook[] | undefined) => {
                            return oldData ? [...oldData, newTextbook] : [newTextbook];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedTextbook = payload.new as Textbook;
                        queryClient.setQueryData(["textbooks", classId], (oldData: Textbook[] | undefined) => {
                            return oldData ? oldData.map(textbook =>
                                textbook.id === updatedTextbook.id ? updatedTextbook : textbook
                            ) : [updatedTextbook];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, queryClient]);

    // Add realtime subscriptions for textbook documents
    useEffect(() => {
        if (!textbooks || textbooks.length === 0) return;

        const channel = supabase
            .channel('realtime-textbook-documents')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'documents',
                    filter: `textbook=in.(${textbooks.map(textbook => textbook.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["textbookDocuments", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, textbooks, queryClient]);

    // Add realtime subscriptions for homeworks
    useEffect(() => {
        const channel = supabase
            .channel('realtime-homeworks')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'homeworks',
                    filter: `class=eq.${classId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newHomework = payload.new as Homework;
                        queryClient.setQueryData(["homeworks", classId], (oldData: Homework[] | undefined) => {
                            return oldData ? [...oldData, newHomework] : [newHomework];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedHomework = payload.new as Homework;
                        queryClient.setQueryData(["homeworks", classId], (oldData: Homework[] | undefined) => {
                            return oldData ? oldData.map(homework =>
                                homework.id === updatedHomework.id ? updatedHomework : homework
                            ) : [updatedHomework];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, queryClient]);

    // Add realtime subscriptions for exercises
    useEffect(() => {
        if (!homeworks || homeworks.length === 0) return;

        const channel = supabase
            .channel('realtime-homework-exercises')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'exercises',
                    filter: `homework=in.(${homeworks.map(homework => homework.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["exercises", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, homeworks, queryClient]);

    // Add realtime subscriptions for homework documents
    useEffect(() => {
        if (!homeworks || homeworks.length === 0) return;

        const channel = supabase
            .channel('realtime-homework-documents')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'documents',
                    filter: `homework=in.(${homeworks.map(homework => homework.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["homeworkDocuments", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, homeworks, queryClient]);

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Content classId={classId} />
            </Container>
        </ClassLayout>
    )
}