/*
 * app/classes/[classId]/textbook/page.tsx
 * This page is for showing the textbooks of the class. It will show all the textbooks of the class, and the option to upload textbooks manually.
 * @AshokSaravanan222
 * 01.03.2025
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Grid } from "@mantine/core";
import { Flex } from "@mantine/core";
import { Container } from "@mantine/core";
import { Text, Card, Image as MantineImage } from "@mantine/core";
import { useRouter } from "next/navigation";
import { FileInput, Progress } from "@mantine/core";
import * as pdfjs from 'pdfjs-dist';
import { Document, Textbook, Topic } from "@/types";
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

    const processTextbook = async (file: File, classId: string) => {
        const file_name = file.name.split(".")[0];
        console.log("File name:", file_name);

        // Add error handling for PDF loading
        let pdf;
        try {
            const pdfBuffer = await file.arrayBuffer();
            const pdfJS = await import('pdfjs-dist');
            pdfJS.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.mjs';
            pdf = await pdfJS.getDocument(pdfBuffer).promise;
        } catch (error) {
            console.error("Error loading PDF:", error);
            throw new Error("Failed to load PDF");
        }

        const numPages = pdf.numPages;
        console.log("Number of pages:", numPages);

        const textbook = await createTextbook(classId, file_name, numPages, `${process.env.NEXT_PUBLIC_API_URL}`);
        console.log("Textbook ID:", textbook.id);

        const pages = [];
        for (let i = 0; i < numPages; i++) {
            try {
                console.log(`Processing page ${i + 1}/${numPages}`);

                // Add timeout protection
                const pagePromise = Promise.race([
                    processPage(pdf, i, textbook.id, classId),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Page processing timeout')), 30000)
                    )
                ]);

                const pageResult = await pagePromise;
                pages.push(pageResult);

                // // Add a small delay between pages to prevent overwhelming
                // await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error: any) {
                console.error(`Error processing page ${i + 1}:`, error);
                pages.push({
                    pageNumber: i + 1,
                    error: error.message
                });
            }
        }

        console.log("Pages processed:", pages);

        // Call the parse-textbook endpoint, do not wait for response
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/parse/textbook`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                class_id: classId,
                textbook_id: textbook.id,
                handwritten: false
            })
        });
        queryClient.invalidateQueries({ queryKey: ["textbooks", classId] });
    };

    async function processPage(pdf: any, pageIndex: number, textbookId: string, classId: string) {
        let tempCanvas: HTMLCanvasElement | null = null;
        let finalCanvas: HTMLCanvasElement | null = null;

        const cleanup = () => {
            if (tempCanvas) {
                tempCanvas.width = 0;
                tempCanvas.height = 0;
            }
            if (finalCanvas) {
                finalCanvas.width = 0;
                finalCanvas.height = 0;
            }
        };

        // Helper function to timeout any promise
        const withTimeout = async (promise: Promise<any>, timeoutMs: number, operation: string) => {
            return Promise.race([
                promise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
                )
            ]);
        };

        try {
            // Get the page with timeout
            const page = await withTimeout(
                pdf.getPage(pageIndex + 1),
                5000, // 5 second timeout for getting the page
                'Getting page'
            );

            let documentId: string | null = null;
            try {
                // Try to get text content with timeout
                const textContent = await withTimeout(
                    page.getTextContent(),
                    10000, // 10 second timeout for text extraction
                    'Text extraction'
                );
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ');
                const result = await createTextbookDocument(textbookId, pageIndex + 1, pageText);
                if (result.success && result.documentId) {
                    documentId = result.documentId;
                    console.log("Page text extracted successfully");
                }
            } catch (textError) {
                console.warn(`Skipping text extraction for page ${pageIndex + 1}:`, textError);
                // Create document with empty text if text extraction fails
                const result = await createTextbookDocument(textbookId, pageIndex + 1, "");
                if (result.success && result.documentId) {
                    documentId = result.documentId;
                }
            }

            if (!documentId) {
                throw new Error("Failed to create document record");
            }

            try {
                // Image processing with timeout
                const imageProcessingPromise = withTimeout(
                    (async () => {
                        const baseViewport = page.getViewport({ scale: 1.0 });
                        const { width: targetWidth, height: targetHeight } = calculateResizedDimensions(
                            baseViewport.width,
                            baseViewport.height
                        );
                        const scale = targetWidth / baseViewport.width;
                        const viewport = page.getViewport({ scale });

                        finalCanvas = document.createElement('canvas');
                        const finalContext = finalCanvas.getContext('2d')!;
                        finalCanvas.width = 1000;
                        finalCanvas.height = 1000;
                        finalContext.fillStyle = 'white';
                        finalContext.fillRect(0, 0, 1000, 1000);

                        const offsetX = Math.floor((1000 - targetWidth) / 2);
                        const offsetY = Math.floor((1000 - targetHeight) / 2);

                        tempCanvas = document.createElement('canvas');
                        const tempContext = tempCanvas.getContext('2d')!;
                        tempCanvas.width = targetWidth;
                        tempCanvas.height = targetHeight;

                        await page.render({
                            canvasContext: tempContext,
                            viewport: viewport
                        }).promise;

                        finalContext.drawImage(tempCanvas, offsetX, offsetY);

                        return { targetWidth, targetHeight, offsetX, offsetY, viewport };
                    })(),
                    15000,
                    'Image processing'
                );

                const imageResult = await imageProcessingPromise;

                // Convert to blob with compression
                const pageBlob = await withTimeout(
                    new Promise<Blob>((resolve, reject) =>
                        finalCanvas?.toBlob(
                            (blob) => blob ? resolve(blob) : reject('Failed to create blob'),
                            'image/png',
                            0.8
                        )
                    ),
                    5000, // 5 second timeout for blob creation
                    'Blob creation'
                );

                // Upload the page image
                const pageUploadPath = `${classId}/${textbookId}/${documentId}.png`;
                await withTimeout(
                    supabase.storage
                        .from("textbooks")
                        .upload(pageUploadPath, pageBlob, {
                            cacheControl: '3600',
                            upsert: true
                        }),
                    20000, // 20 second timeout for upload
                    'Image upload'
                );

                // Try to process embedded images with timeout
                let embeddedImagesInfo = [];
                try {
                    const operatorList = await withTimeout(
                        page.getOperatorList(),
                        10000, // 10 second timeout for operator list
                        'Getting operator list'
                    );
                    const pdfJS = await import('pdfjs-dist');

                    // Process embedded images with a global timeout
                    const processedImages = await withTimeout(
                        processEmbeddedImages(operatorList, page, pdfJS, imageResult),
                        1000, // 1 second timeout for all image processing
                        'Processing embedded images'
                    );
                    embeddedImagesInfo = processedImages;
                } catch (imageError) {
                    console.warn(`Skipping embedded images for page ${pageIndex + 1}:`, imageError);
                }

                // Create figures if we have any embedded images
                if (embeddedImagesInfo.length > 0) {
                    try {
                        const figures = embeddedImagesInfo.map((image: any) => ({
                            y_min: Math.max(0, image.normalizedDimensions.y),
                            y_max: Math.min(1000, image.normalizedDimensions.y + image.normalizedDimensions.height),
                            x_min: Math.max(0, image.normalizedDimensions.x),
                            x_max: Math.min(1000, image.normalizedDimensions.x + image.normalizedDimensions.width),
                            description: "",
                            document: documentId
                        }));

                        await withTimeout(
                            createFigures(figures),
                            10000, // 10 second timeout for creating figures
                            'Creating figures'
                        );
                    } catch (figuresError) {
                        console.warn(`Skipping figures creation for page ${pageIndex + 1}:`, figuresError);
                    }
                }

                return {
                    pageNumber: pageIndex + 1,
                    dimensions: {
                        width: 1000,
                        height: 1000,
                        contentWidth: imageResult.targetWidth,
                        contentHeight: imageResult.targetHeight,
                        offsetX: imageResult.offsetX,
                        offsetY: imageResult.offsetY
                    },
                    embeddedImages: embeddedImagesInfo
                };

            } catch (imageError: any) {
                console.warn(`Image processing failed for page ${pageIndex + 1}:`, imageError);
                // Return basic page info even if image processing fails
                return {
                    pageNumber: pageIndex + 1,
                    error: imageError.message,
                    documentId
                };
            }

        } catch (error) {
            throw error;
        } finally {
            cleanup();
        }
    }

    // Helper function to process embedded images
    async function processEmbeddedImages(operatorList: any, page: any, pdfJS: any, imageResult: any) {
        const embeddedImagesInfo = [];
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
                    console.warn("Could not find valid transform matrix for image:", objId);
                    continue;
                }

                const imgData = await new Promise<any>(resolve => {
                    page.objs.get(objId, (data: any) => resolve(data));
                });

                if (imgData && typeof imgData.width === 'number' && typeof imgData.height === 'number') {
                    const [a, b, c, d, e, f] = transform;
                    const PDF_POINTS_PER_PIXEL = 72 / 96;

                    const width = Math.abs(a / PDF_POINTS_PER_PIXEL);
                    const height = Math.abs(d / PDF_POINTS_PER_PIXEL);
                    const x = e / PDF_POINTS_PER_PIXEL;
                    const y = imageResult.viewport.height - ((f / PDF_POINTS_PER_PIXEL) + height);
                    const pageScaleFactor = imageResult.targetWidth / imageResult.targetWidth;

                    const originalDims = {
                        x: Math.round(x),
                        y: Math.round(y),
                        width: Math.round(width),
                        height: Math.round(height)
                    };

                    if (!Object.values(originalDims).some(isNaN)) {
                        const normalizedDims = {
                            x: Math.round((originalDims.x * pageScaleFactor) + imageResult.offsetX),
                            y: Math.round((originalDims.y * pageScaleFactor) + imageResult.offsetY),
                            width: Math.round(originalDims.width * pageScaleFactor),
                            height: Math.round(originalDims.height * pageScaleFactor)
                        };

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
                                targetWidth: imageResult.targetWidth,
                                targetHeight: imageResult.targetHeight,
                                offsetX: imageResult.offsetX,
                                offsetY: imageResult.offsetY
                            }
                        });

                        embeddedImagesInfo.push({
                            dimensions: originalDims,
                            normalizedDimensions: normalizedDims
                        });
                    }
                }
            }
        }
        return embeddedImagesInfo;
    }

    const getProgress = useMemo(() => {
        return (textbookId: string, uploading: boolean = false) => {
            if (!documents || !textbooks) return 0;
            const textbookDocuments = documents.filter(document =>
                document.textbook === textbookId && (uploading || document.processed)
            );
            const textbook = textbooks.find(textbook => textbook.id === textbookId);
            if (!textbook || textbook.pages === 0) return 0;
            return (textbookDocuments.length / textbook.pages) * 100;
        };
    }, [documents, textbooks]);

    const getEstimatedTime = useMemo(() => {
        return (textbookId: string, uploading: boolean = false) => {
            const textbook = textbooks?.find(textbook => textbook.id === textbookId);
            if (!textbook || textbook.pages === 0) return 0;
            return Number(((textbook.pages * 4)) * (100 - getProgress(textbookId, uploading)) / 100).toFixed(2);
        };
    }, [documents, textbooks]);

    const handleRetry = async (classId: string, textbook: Textbook) => {
        try {
            setParsingTextbooks(prev => new Set(prev).add(textbook.id));
            // Call the parse-textbook endpoint, do not wait for response
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/parse/textbook`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    class_id: classId,
                    textbook_id: textbook.id,
                    handwritten: false
                })
            });
            queryClient.invalidateQueries({ queryKey: ["textbooks", classId] });
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

    const getDocumentImage = (textbookId: string) => {
        if (!textbookId) return '/placeholder_image.svg';
        const document = documents?.find(document => document.textbook === textbookId);
        if (!document) return '/placeholder_image.svg';
        return `https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/textbooks/${classId}/${document.textbook}/${document.id}.png`
    }

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
                        console.log("Textbook:", newTextbook);
                        // Update your textbooks state with the new data
                        queryClient.setQueryData(["textbooks", classId], (oldData: Textbook[]) => {
                            return [...oldData, newTextbook];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedTextbook = payload.new as Textbook;
                        console.log("Updated Textbook:", updatedTextbook);
                        queryClient.setQueryData(["textbooks", classId], (oldData: Textbook[]) => {
                            return oldData.map(textbook => textbook.id === updatedTextbook.id ? updatedTextbook : textbook);
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase]);

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

                    // Immediately invalidate the documents query to trigger a refresh
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
                            if (textbook.parse_status !== "complete") {
                                const progress = getProgress(textbook.id, parsingTextbooks.has(textbook.id));
                                const estimatedMinutes = getEstimatedTime(textbook.id, parsingTextbooks.has(textbook.id));
                                return (
                                    <Card withBorder key={textbook.id}>
                                        <Group align="flex-start" justify="space-between">
                                            <Group align="flex-start">
                                                <MantineImage
                                                    src={getDocumentImage(textbook.id)}
                                                    alt={`First page of ${textbook.title}`}
                                                    width={200}
                                                    height={150}
                                                    fit="contain"
                                                    fallbackSrc="/placeholder_image.svg"
                                                />
                                                <Stack gap="xs">
                                                    <Text size="lg" fw={500}>{textbook.title}</Text>
                                                    <Text size="sm" c="dimmed">
                                                        {textbook.parse_status === 'parsing' ? 'Parsing...' :
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
                                                        value={getProgress(textbook.id, textbook.parse_status !== 'parsing')}
                                                        size="sm"
                                                        color="blue"
                                                        animated={textbook.parse_status === 'parsing'}
                                                        striped={textbook.parse_status === 'parsing'}
                                                    />
                                                    {(textbook.parse_status === 'parsing') && (
                                                        <Text size="sm" c="dimmed">
                                                            Estimated time remaining: ~{getEstimatedTime(textbook.id, textbook.parse_status !== 'parsing')} seconds
                                                        </Text>
                                                    )}
                                                </Stack>
                                            </Group>
                                            <Button
                                                variant="light"
                                                color="blue"
                                                onClick={() => handleRetry(classId, textbook)}
                                                leftSection={<IconRefresh size={16} />}
                                                disabled={textbook.parse_status === 'parsing' || textbook.parse_status === 'idle'}
                                                loading={parsingTextbooks.has(textbook.id)}
                                            >
                                                {parsingTextbooks.has(textbook.id) ? 'Retrying...' :
                                                    textbook.parse_status === 'parsing' ? 'Parsing...' :
                                                    textbook.parse_status === 'error' ? 'Retry Parse' :
                                                    'Processing...'}
                                            </Button>
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
                                                src={getDocumentImage(textbook.id)}
                                                alt={`First page of ${textbook.title}`}
                                                width={200}
                                                height={150}
                                                fit="contain"
                                                fallbackSrc="/placeholder_image.svg"
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