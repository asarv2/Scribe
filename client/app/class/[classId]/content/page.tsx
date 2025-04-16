/**
 * app/classes/c/[classId]/content/page.tsx
 * This page will be an interactive page allowing the professor to view the content for the class, which includes lectures, textbooks (and their chapters in particular), and homework assignments.
 * @AshokSaravanan222
 * 03/06/2025
 * 
 */
"use client";

import { useEffect } from "react";

import useSupabaseBrowser from "@/utils/supabase/supabase-browser";

import { use } from "react";
import { ClassLayout } from "@/components/Class/ClassLayout";
import { Container } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { File, Homework, Lecture, Textbook } from "@/types";
import { getFiles } from "@/utils/queries/get-files";
import Content from "@/components/Content/Content";

export default function ContentPage({ params }: { params: Promise<{ classId: string }> }) {
    const { classId } = use(params);
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();

    const { data: files, isLoading: loadingFiles } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, [classId])
    });

    // Add realtime subscriptions for files
    useEffect(() => {
        const channel = supabase
            .channel('realtime-files')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'files',
                    filter: `class=eq.${classId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newFile = payload.new as File;
                        queryClient.setQueryData(["files", classId], (oldData: File[] | undefined) => {
                            return oldData ? [...oldData, newFile] : [newFile];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedFile = payload.new as File;
                        queryClient.setQueryData(["files", classId], (oldData: File[] | undefined) => {
                            return oldData ? oldData.map(file =>
                                file.id === updatedFile.id ? updatedFile : file
                            ) : [updatedFile];
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
        if (!files || files.length === 0) return;

        const channel = supabase
            .channel('realtime-lecture-documents')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'documents',
                    filter: `file=in.(${files.map(file => file.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["fileDocuments", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, files, queryClient]);

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Content classId={classId} navigateHomeAfterDelete={false} />
            </Container>
        </ClassLayout>
    )
}