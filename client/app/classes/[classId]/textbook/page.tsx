/*
 * app/classes/[classId]/textbook/page.tsx
 * This page is for showing the textbooks of the class. It will show all the textbooks of the class, and the option to upload textbooks manually.
 * @AshokSaravanan222
 * 01.03.2025
 */
"use client"

import { useEffect, useRef, useState } from "react";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import Markdown from 'markdown-to-jsx'
import Image from "next/image";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { HeaderSimple } from "@/components/HeaderSimple";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";;
import { usePathname } from "next/navigation";
import { IconArrowLeft, IconArrowRight, IconUpload, IconRefresh } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Button, em, Group, Loader, Stack } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLecture } from "@/utils/queries/get-lecture";
import { Grid } from "@mantine/core";
import { Flex } from "@mantine/core";
import { Container } from "@mantine/core";
import DeleteLectureModal from "@/components/DeleteLectureModal";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getLectures } from "@/utils/queries/get-lectures";
import { Text, Card, Image as MantineImage } from "@mantine/core";
import { useRouter } from "next/navigation";
import { FileInput, Progress } from "@mantine/core";
import { createLecture } from "@/utils/services/lecture";
import * as pdfjs from 'pdfjs-dist';
import { Document, Lecture, Textbook, Topic } from "@/types";
import { getTopics } from "@/utils/queries/get-topics";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { createTextbook } from "@/utils/services/textbook";
import { getDocumentsTextbook } from "@/utils/queries/get-documents-textbook";
import { createTextbookDocument } from "@/utils/services/document";
import { createFigures } from "@/utils/services/figures";
import { calculateResizedDimensions } from "@/utils/services/resize";

export default function TextbookPage({ params }: { params: { classId: string } }) {
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const fileInputRef = useRef<HTMLButtonElement>(null);
    const classId = params.classId;
    const router = useRouter();

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: textbooks, isLoading: loadingTextbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId)
    })

    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getDocumentsTextbook(supabase, textbooks?.map(textbook => textbook.id) ?? []),
        enabled: !!textbooks
    })

    const { data: topics, isLoading: loadingTopics } = useQuery({
        queryKey: ["topics", classId],
        queryFn: () => getTopics(supabase, classId, classData!.map),
        enabled: !!classData
    })

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [parsingTextbooks, setParsingTextbooks] = useState<Set<string>>(new Set());
    const [progressMap, setProgressMap] = useState<Record<string, number>>({});

    const handleFilesUpload = async (files: File[] | null) => {
        if (!files || files.length === 0) {
            notifications.show({
                title: 'Error',
                message: 'Please select PDF files',
                color: 'red'
            });
            return;
        }

        // check if the files are pdf or .mp4
        const invalidFiles = files.filter(file => !file.type.includes('pdf'));
        if (invalidFiles.length > 0) {
            notifications.show({
                title: 'Error',
                message: 'Only PDF files are allowed',
                color: 'red'
            });
            return;
        }

        try {
            setSelectedFiles(files);

            const uploadPromises = files.map(async (file) => {
                try {
                    await processTextbook(
                        file,
                        classId,
                    );

                    notifications.show({
                        title: 'Success',
                        message: `${file.name} uploaded successfully`,
                        color: 'green'
                    });
                } catch (error) {
                    notifications.show({
                        title: 'Error',
                        message: `Failed to upload ${file.name}`,
                        color: 'red'
                    });
                    console.error(`Upload error for ${file.name}:`, error);
                }
            });

            await Promise.all(uploadPromises);

            setSelectedFiles([]);

        } catch (error) {
            notifications.show({
                title: 'Error',
                message: 'Failed to process files',
                color: 'red'
            });
            console.error('Upload error:', error);
        }
    };

    const processTextbook = async (
        file: File,
        classId: string,
    ) => {
        const file_name = file.name.split(".")[0];
        console.log("File name:", file_name);

        // convert file to array buffer
        const pdfBuffer = await file.arrayBuffer();

        // Get actual page count using PDF.js with proper worker setup
        const pdfJS = await import('pdfjs-dist');
        pdfJS.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.mjs';

        const pdf = await pdfJS.getDocument(pdfBuffer).promise;
        const numPages = pdf.numPages;
        console.log("Number of pages:", numPages);

        const textbook = await createTextbook(classId, file_name, numPages);
        console.log("Textbook ID:", textbook.id);
        // uploading images to supabase
        const pages = await Promise.all(Array.from({ length: numPages }, async (_, i) => {
            const page = await pdf.getPage(i + 1);

            // Extract text content
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            const {success, error, documentId} = await createTextbookDocument(textbook.id, i + 1, pageText);
            if (!success || !documentId) {
                throw new Error(error);
            }
            console.log("Page text:", pageText);

            // Calculate initial viewport size at scale 1.0
            const baseViewport = page.getViewport({ scale: 1.0 });
            
            // Calculate scale needed to fit within 1000x1000
            const { width: targetWidth, height: targetHeight } = calculateResizedDimensions(
                baseViewport.width,
                baseViewport.height
            );
            const scale = targetWidth / baseViewport.width;

            // Create viewport with calculated scale
            const viewport = page.getViewport({ scale });

            // Create a 1000x1000 canvas with white background
            const finalCanvas = document.createElement('canvas');
            const finalContext = finalCanvas.getContext('2d')!;
            finalCanvas.width = 1000;
            finalCanvas.height = 1000;

            // Fill with white background
            finalContext.fillStyle = 'white';
            finalContext.fillRect(0, 0, 1000, 1000);

            // Calculate centering offsets
            const offsetX = Math.floor((1000 - targetWidth) / 2);
            const offsetY = Math.floor((1000 - targetHeight) / 2);

            // First render to temporary canvas at calculated size
            const tempCanvas = document.createElement('canvas');
            const tempContext = tempCanvas.getContext('2d')!;
            tempCanvas.width = targetWidth;
            tempCanvas.height = targetHeight;

            await page.render({
                canvasContext: tempContext,
                viewport: viewport
            }).promise;

            // Copy centered image to final canvas
            finalContext.drawImage(tempCanvas, offsetX, offsetY);

            // Convert to blob with compression
            const pageBlob = await new Promise<Blob>((resolve, reject) =>
                finalCanvas.toBlob(
                    (blob) => blob ? resolve(blob) : reject('Failed to create blob'),
                    'image/png',
                    0.8
                )
            );

            // For embedded images, adjust coordinates to account for padding
            const operatorList = await page.getOperatorList();
            const embeddedImagesInfo = [];

            // Helper function to get PDF object safely
            const getPdfObject = (objs: any, objId: string): Promise<any> => {
                return new Promise((resolve) => {
                    objs.get(objId, (data: any) => {
                        resolve(data);
                    });
                });
            };

            for (let j = 0; j < operatorList.fnArray.length; j++) {
                if (operatorList.fnArray[j] === pdfJS.OPS.paintImageXObject) {
                    const objId = operatorList.argsArray[j][0];
                    
                    // Find the most recent transform matrix
                    let transform = null;
                    for (let k = j; k >= 0; k--) {
                        if (operatorList.fnArray[k] === pdfJS.OPS.transform) {
                            transform = operatorList.argsArray[k];
                            break;
                        }
                    }

                    if (!transform || transform.length !== 6) {
                        console.log("Could not find valid transform matrix for image:", objId);
                        continue;
                    }

                    const imgData = await getPdfObject(page.objs, objId);
                    
                    if (imgData && typeof imgData.width === 'number' && typeof imgData.height === 'number') {
                        const [a, b, c, d, e, f] = transform;

                        // PDF points to pixels conversion
                        const PDF_POINTS_PER_PIXEL = 72 / 96;

                        // Calculate dimensions in pixels
                        const width = Math.abs(a / PDF_POINTS_PER_PIXEL);
                        const height = Math.abs(d / PDF_POINTS_PER_PIXEL);
                        
                        // Convert position to pixels
                        const x = e / PDF_POINTS_PER_PIXEL;
                        const y = viewport.height - ((f / PDF_POINTS_PER_PIXEL) + height);

                        // Calculate the scale relative to the original page size
                        const pageScaleFactor = targetWidth / baseViewport.width;

                        const originalDims = {
                            x: Math.round(x),
                            y: Math.round(y),
                            width: Math.round(width),
                            height: Math.round(height)
                        };

                        if (!Object.values(originalDims).some(isNaN)) {
                            // Apply the same page scaling to the image dimensions
                            const normalizedDims = {
                                x: Math.round((originalDims.x * pageScaleFactor) + offsetX),
                                y: Math.round((originalDims.y * pageScaleFactor) + offsetY),
                                width: Math.round(originalDims.width * pageScaleFactor),
                                height: Math.round(originalDims.height * pageScaleFactor)
                            };

                            // Verify dimensions are within bounds
                            console.log("Valid image found:", {
                                objId,
                                pageScale: pageScaleFactor,
                                original: originalDims,
                                normalized: normalizedDims,
                                imageData: {
                                    width: imgData.width,
                                    height: imgData.height
                                },
                                pageInfo: {
                                    targetWidth,
                                    targetHeight,
                                    offsetX,
                                    offsetY
                                }
                            });

                            embeddedImagesInfo.push({
                                dimensions: originalDims,
                                normalizedDimensions: normalizedDims
                            });
                        }
                    } else {
                        console.log("Invalid image data for objId:", objId, imgData);
                    }
                }
            }

            const figures = embeddedImagesInfo.map(image => {
                return {
                    y_min: Math.max(0, image.normalizedDimensions.y),
                    y_max: Math.min(1000, image.normalizedDimensions.y + image.normalizedDimensions.height),
                    x_min: Math.max(0, image.normalizedDimensions.x),
                    x_max: Math.min(1000, image.normalizedDimensions.x + image.normalizedDimensions.width),
                    description: "",
                    document: documentId
                }
            })

            // uploading figures to supabase
            const {success: successFigures, error: errorFigures} = await createFigures(figures)
            if (!successFigures) {
                throw new Error(errorFigures);
            }

            // Upload resized page
            const pageUploadPath = `${classId}/textbooks/${textbook.id}/images/${i + 1}.png`;
            await supabase.storage
                .from("slides")
                .upload(pageUploadPath, pageBlob, {
                    cacheControl: '3600',
                    upsert: true
                });

            return {
                pageNumber: i + 1,
                dimensions: {
                    width: 1000,
                    height: 1000,
                    contentWidth: targetWidth,
                    contentHeight: targetHeight,
                    offsetX,
                    offsetY
                },
                embeddedImages: embeddedImagesInfo
            };
        }));

        console.log("Pages processed:", pages);

        // don't wait for the response
        supabase.functions.invoke('parse-textbook', {
            body: {
                class_id: classId,
                textbook_id: textbook.id,
                handwritten: true
            }
        });
    };

    const getProgress = (textbookId: string, uploading: boolean = false) => {
        if (progressMap[textbookId] !== undefined) {
            return progressMap[textbookId];
        }

        if (!documents || !textbooks) return 0;
        const textbookDocuments = documents.filter(document => document.textbook === textbookId && (uploading || document.processed));
        const textbook = textbooks.find(textbook => textbook.id === textbookId);
        if (!textbook || textbook.pages === 0) return 0;
        const progress = (textbookDocuments.length / textbook.pages) * 100;

        setProgressMap(prev => ({
            ...prev,
            [textbookId]: progress
        }));

        return progress;
    };

    const canRetry = (textbook: Textbook) => {
        const TIMEOUT = 150 * 1000; // 150 seconds in milliseconds
        if (textbook.last_parse_attempt) {
            const lastAttempt = new Date(textbook.last_parse_attempt);
            const timeSinceLastAttempt = Date.now() - lastAttempt.getTime();
            if (timeSinceLastAttempt > TIMEOUT && (textbook.parse_status === 'parsing' || textbook.parse_status === 'batching')) {
                return true;
            }
        }
        return false;
    }


    const handleRetry = async (classId: string, textbook: Textbook) => {
        try {
            setParsingTextbooks(prev => new Set(prev).add(textbook.id));
            const response = await supabase.functions.invoke('parse-textbook', {
                body: {
                    class_id: classId,
                    textbook_id: textbook.id,
                    handwritten: true
                }
            });

            if (response.error) {
                throw new Error(response.error.message);
            }
        } catch (error) {
            console.error('Error retrying:', error);
            notifications.show({
                title: 'Error',
                message: `Failed to retry parsing. Please try again.`,
                color: 'red'
            });
        } finally {
            setParsingTextbooks(prev => {
                const next = new Set(prev);
                next.delete(textbook.id);
                return next;
            });
        }
    };

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
                        console.log("New Textbook:", newTextbook);
                        queryClient.setQueryData(["textbooks", classId], (oldData: Textbook[] = []) => {
                            return [...oldData, newTextbook];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedTextbook = payload.new as Textbook;
                        console.log("Updated Textbook:", updatedTextbook);
                        queryClient.invalidateQueries({
                            queryKey: ["textbooks", classId]
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, queryClient]);

    useEffect(() => {
        if (!textbooks) return;
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
                (payload) => {
                    console.log("Document change:", payload);

                    // Update documents in React Query cache
                    queryClient.setQueryData(["textbookDocuments", classId], (oldData: Document[] = []) => {
                        let newData;
                        if (payload.eventType === 'INSERT') {
                            newData = [...oldData, payload.new];
                        } else if (payload.eventType === 'DELETE') {
                            newData = oldData.filter(doc => doc.id !== payload.old.id);
                        } else if (payload.eventType === 'UPDATE') {
                            newData = oldData.map(doc =>
                                doc.id === payload.new.id ? payload.new : doc
                            );
                        } else {
                            newData = oldData;
                        }
                        const newDocument = payload.new as Document;

                        // Update progress for the affected lecture
                        const textbookId = newDocument.textbook;
                        if (textbookId) {
                            const textbook = textbooks?.find(t => t.id === textbookId);
                            if (textbook) {
                                const progress = (newData.filter(doc => doc.textbook === textbookId).length / textbook.pages) * 100;
                                setProgressMap(prev => ({
                                    ...prev,
                                    [textbookId]: progress
                                }));
                            }
                        }

                        return newData;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, textbooks, queryClient]);

    return (
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            {/* <Link href={`/`}>
                                <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} />
                            </Link> */}
                            <Text size="xl" fw={700} mb={6} pl={4}>Textbooks</Text>
                        </Group>
                        <Group>
                            <Button onClick={() => fileInputRef.current?.click()} leftSection={<IconUpload size={14} />}>Upload Textbooks</Button>
                            <FileInput
                                ref={fileInputRef}
                                placeholder="Upload PDFs"
                                accept="application/pdf,video/mp4"
                                multiple
                                onChange={handleFilesUpload}
                                value={selectedFiles}
                                style={{ display: 'none' }}
                            />
                        </Group>
                    </Flex>

                    <Stack>
                        {(textbooks && classData) && textbooks.length > 0 && textbooks.sort((a, b) => new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime()).map((textbook) => {
                            if (textbook.parse_status !== "complete" || canRetry(textbook)) {
                                const progress = getProgress(textbook.id, parsingTextbooks.has(textbook.id));
                                const remainingPages = textbook.pages - Math.floor((progress / 100) * textbook.pages);
                                const estimatedSeconds = remainingPages * 4;
                                const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
                                return (
                                    <Card withBorder key={textbook.id}>
                                        <Group align="flex-start" justify="space-between">
                                            <Group align="flex-start">
                                                <MantineImage
                                                    src={`https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/slides/${classId}/textbooks/${textbook.id}/images/1.png`}
                                                    alt={`First page of ${textbook.title}`}
                                                    width={200}
                                                    height={150}
                                                    fit="contain"
                                                    fallbackSrc="/placeholder_image.svg"
                                                />
                                                <Stack gap="xs">
                                                    <Text size="lg" fw={500}>{textbook.title}</Text>
                                                    {canRetry(textbook) ? (
                                                        <Text size="sm" c="dimmed">
                                                            {textbook.parse_status === 'parsing' ? 'Retry parsing. The function may have timed out.' :
                                                                textbook.parse_status === 'error' ? 'Retry parse. The function may have timed out.' : 'Retry parse. The function may have timed out.'}
                                                        </Text>
                                                    ) : (
                                                        <Text size="sm" c="dimmed">
                                                            {textbook.parse_status === 'parsing' ? 'Parsing...' :
                                                                textbook.parse_status === 'error' ? 'Parse failed' : textbook.parse_status === 'idle' ? 'Waiting to parse' : 'Could not find any topics.'}
                                                        </Text>
                                                    )}
                                                    {textbook.parse_error && (
                                                        <Text size="sm" c="red">
                                                            Error: {textbook.parse_error}
                                                        </Text>
                                                    )}
                                                    {canRetry(textbook) ?
                                                        <Progress
                                                            value={progress}
                                                            size="sm"
                                                            color={textbook.parse_status === 'parsing' ? 'blue' :
                                                                'blue'}
                                                        /> :
                                                        <Progress
                                                            value={progress}
                                                            size="sm"
                                                            color={textbook.parse_status === 'parsing' ? 'blue' :
                                                                'blue'}
                                                            animated={textbook.parse_status === 'parsing'}
                                                            striped={textbook.parse_status === 'parsing'}
                                                        />}
                                                    {(textbook.parse_status === 'parsing') && (
                                                        <Text size="sm" c="dimmed">
                                                            Estimated time remaining: ~{estimatedMinutes} minute{estimatedMinutes !== 1 ? 's' : ''}
                                                        </Text>
                                                    )}
                                                </Stack>
                                            </Group>
                                            {canRetry(textbook) ?
                                                <Button
                                                    variant="light"
                                                    color={"blue"}
                                                    onClick={() => handleRetry(classId, textbook)}
                                                    leftSection={<IconRefresh size={16} />}
                                                    loading={parsingTextbooks.has(textbook.id)}
                                                >
                                                    {parsingTextbooks.has(textbook.id) ? 'Retrying...' :
                                                        textbook.parse_status === 'parsing' ? 'Retry Parsing' :
                                                            textbook.parse_status === 'error' ? 'Retry Parse' :
                                                                'Processing...'}
                                                </Button> : <Button
                                                    variant="light"
                                                    color={"blue"}
                                                    onClick={() => handleRetry(classId, textbook)}
                                                    leftSection={<IconRefresh size={16} />}
                                                    disabled={textbook.parse_status === 'parsing' || textbook.parse_status === 'idle'}
                                                    loading={parsingTextbooks.has(textbook.id)}
                                                >
                                                    {parsingTextbooks.has(textbook.id) ? 'Retrying...' :
                                                        textbook.parse_status === 'parsing' ? 'Parsing...' :
                                                            textbook.parse_status === 'error' ? 'Retry Parse' :
                                                                'Processing...'}
                                                </Button>}
                                        </Group>
                                    </Card>
                                )
                            }
                            return (
                                <Link
                                    href={`/classes/${classId}/textbook/${textbook.id}`}
                                    key={textbook.id}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <Card withBorder>
                                        <Group align="flex-start">
                                            <MantineImage
                                                src={`https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/slides/${classId}/textbooks/${textbook.id}/images/1.png`}
                                                alt={`First page of ${textbook.title}`}
                                                width={200}
                                                height={150}
                                                fit="contain"
                                                fallbackSrc="/placeholder_image.svg" // You might want to add a placeholder image
                                            />
                                            <Stack gap="xs">
                                                <Text size="lg" fw={500}>{textbook.title}</Text>
                                                <Text size="sm" c="dimmed">
                                                    Uploaded {new Date(textbook.created_at ?? "").toLocaleDateString()}
                                                </Text>
                                            </Stack>
                                        </Group>
                                    </Card>
                                </Link>
                            );
                        })}
                    </Stack>
                </Stack>
            </Container>

        </>
    );
}