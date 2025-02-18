/**
 * app/classes/[classId]/lecture/page.tsx
 * This page is for showing the lectures of the class. It will show all the lectures of the class, and the option to upload lectures manually.
 * @AshokSaravanan222
 * 01.03.2025
 */
"use client"

import { useEffect, useRef, useState, useMemo } from "react";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import Image from "next/image";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";;
import { usePathname } from "next/navigation";
import { IconArrowLeft, IconArrowRight, IconUpload, IconRefresh } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Button, em, Group, Loader, Stack, useMantineColorScheme } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLecture } from "@/utils/queries/get-lecture";
import { Grid } from "@mantine/core";
import { Flex } from "@mantine/core";
import { Container } from "@mantine/core";
import DeleteLectureModal from "@/components/Delete/DeleteLectureModal";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getLectures } from "@/utils/queries/get-lectures";
import { Text, Card } from "@mantine/core";
import { useRouter } from "next/navigation";
import { FileInput, Progress } from "@mantine/core";
import { createLecture } from "@/utils/services/lecture";
import * as pdfjs from 'pdfjs-dist';
import { Document, Lecture } from "@/types";
import { getDocumentsLecture } from "@/utils/queries/get-documents-lecture";
import { createLectureDocument, createTextbookDocument } from "@/utils/services/document";
import { createTextbook } from "@/utils/services/textbook";
import { calculateResizedDimensions } from "@/utils/services/resize";
import { ClassLayout } from "@/components/Class/ClassLayout";

export default function LecturePage({ params }: { params: { classId: string } }) {
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const fileInputRef = useRef<HTMLButtonElement>(null);
    const classId = params.classId;
    const router = useRouter();

    const { colorScheme } = useMantineColorScheme();

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId, false)
    })

    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getDocumentsLecture(supabase, lectures?.map(lecture => lecture.id) ?? []),
        enabled: !!lectures
    })

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [parsingLectures, setParsingLectures] = useState<Set<string>>(new Set());

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
        const invalidFiles = files.filter(file => !file.type.includes('pdf') && !file.type.includes('mp4'));
        if (invalidFiles.length > 0) {
            notifications.show({
                title: 'Error',
                message: 'Only PDF and MP4 files are allowed',
                color: 'red'
            });
            return;
        }

        try {
            setSelectedFiles(files);

            const uploadPromises = files.map(async (file) => {
                try {
                    if (file.type.includes('pdf')) {
                        await processLecturePDF(
                            file,
                            classId,
                        );
                    } else if (file.type.includes('mp4')) {
                        await processLectureMP4(
                            file,
                            classId,
                        );
                    } else {
                        throw new Error('Invalid file type');
                    }

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

    const processLecturePDF = async (file: File, classId: string) => {
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

        const lecture = await createLecture(classId, file_name, (lectures?.length ?? 0) + 1, numPages, 1, `${process.env.NEXT_PUBLIC_API_URL}`, false);
        console.log("Lecture ID:", lecture.id);

        const pages = [];
        for (let i = 0; i < numPages; i++) {
            try {
                console.log(`Processing page ${i + 1}/${numPages}`);

                // Add timeout protection
                const pagePromise = Promise.race([
                    processPage(pdf, i, lecture.id, classId),
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

        // Call the parse-lecture endpoint, do not wait for response
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/parse/lecture`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                lecture_id: lecture.id,
            })
        });
        queryClient.invalidateQueries({ queryKey: ["lectures", classId] });
    };

    async function processPage(pdf: any, pageIndex: number, lectureId: string, classId: string) {
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
                const result = await createLectureDocument(lectureId, pageIndex + 1, pageText);
                if (result.success && result.documentId) {
                    documentId = result.documentId;
                    console.log("Page text extracted successfully");
                }
            } catch (textError) {
                console.warn(`Skipping text extraction for page ${pageIndex + 1}:`, textError);
                // Create document with empty text if text extraction fails
                const result = await createLectureDocument(lectureId, pageIndex + 1, "");
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
                const pageUploadPath = `${classId}/${lectureId}/${documentId}.png`;
                await withTimeout(
                    supabase.storage
                        .from("lectures")
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
                        console.log("Figures:", figures);
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

    const processLectureMP4 = async (file: File, classId: string) => {
        try {
            // Create video element for processing
            const video = document.createElement('video');
            video.preload = 'metadata';
            
            // Get video duration and create object URL
            const videoUrl = URL.createObjectURL(file);
            const duration = await new Promise<number>((resolve) => {
                video.onloadedmetadata = () => resolve(video.duration);
                video.src = videoUrl;
            });

            // Calculate samples (2 frames per minute)
            const numSamples = Math.max(2 * Math.ceil(duration / 60), 1);
            const sampleInterval = duration / numSamples;

            // Create lecture entry first
            const lecture = await createLecture(
                classId,
                file.name.split(".")[0],
                (lectures?.length ?? 0) + 1,
                numSamples,
                1,
                `${process.env.NEXT_PUBLIC_API_URL}`,
                true
            );

            // Create AudioContext and source
            const audioContext = new AudioContext();
            const audioBuffer = await file.arrayBuffer()
                .then(buffer => audioContext.decodeAudioData(buffer));

            // Create canvas for frame extraction
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;

            // Function to extract frame at specific timestamp
            const extractFrame = async (timestamp: number): Promise<Blob> => {
                return new Promise((resolve, reject) => {
                    video.currentTime = timestamp;
                    video.onseeked = async () => {
                        try {
                            const { width: targetWidth, height: targetHeight } = calculateResizedDimensions(
                                video.videoWidth,
                                video.videoHeight
                            );

                            canvas.width = 1000;
                            canvas.height = 1000;
                            ctx.fillStyle = 'white';
                            ctx.fillRect(0, 0, 1000, 1000);

                            const offsetX = Math.floor((1000 - targetWidth) / 2);
                            const offsetY = Math.floor((1000 - targetHeight) / 2);

                            ctx.drawImage(video, offsetX, offsetY, targetWidth, targetHeight);

                            canvas.toBlob(
                                (blob) => blob ? resolve(blob) : reject('Failed to create blob'),
                                'image/png',
                                0.8
                            );
                        } catch (error) {
                            reject(error);
                        }
                    };
                });
            };

            // Function to extract audio chunk
            const extractAudioChunk = async (startTime: number, endTime: number): Promise<Blob> => {
                const startSample = Math.floor(startTime * audioContext.sampleRate);
                const endSample = Math.floor(endTime * audioContext.sampleRate);
                const numberOfChannels = audioBuffer.numberOfChannels;
                
                // Create new buffer for the chunk
                const chunkBuffer = audioContext.createBuffer(
                    numberOfChannels,
                    endSample - startSample,
                    audioContext.sampleRate
                );

                // Copy data from original buffer to chunk
                for (let channel = 0; channel < numberOfChannels; channel++) {
                    const channelData = audioBuffer.getChannelData(channel);
                    const chunkData = chunkBuffer.getChannelData(channel);
                    for (let i = 0; i < chunkBuffer.length; i++) {
                        chunkData[i] = channelData[i + startSample];
                    }
                }

                // Convert buffer to WAV blob
                const offlineContext = new OfflineAudioContext(
                    numberOfChannels,
                    chunkBuffer.length,
                    audioContext.sampleRate
                );
                
                const source = offlineContext.createBufferSource();
                source.buffer = chunkBuffer;
                source.connect(offlineContext.destination);
                source.start();

                const renderedBuffer = await offlineContext.startRendering();
                
                // Convert to WAV
                const wavBlob = await new Promise<Blob>((resolve) => {
                    const numberOfChannels = renderedBuffer.numberOfChannels;
                    const length = renderedBuffer.length * numberOfChannels * 2;
                    const buffer = new ArrayBuffer(44 + length);
                    const view = new DataView(buffer);
                    
                    // WAV header
                    writeString(view, 0, 'RIFF');
                    view.setUint32(4, 36 + length, true);
                    writeString(view, 8, 'WAVE');
                    writeString(view, 12, 'fmt ');
                    view.setUint32(16, 16, true);
                    view.setUint16(20, 1, true);
                    view.setUint16(22, numberOfChannels, true);
                    view.setUint32(24, audioContext.sampleRate, true);
                    view.setUint32(28, audioContext.sampleRate * numberOfChannels * 2, true);
                    view.setUint16(32, numberOfChannels * 2, true);
                    view.setUint16(34, 16, true);
                    writeString(view, 36, 'data');
                    view.setUint32(40, length, true);

                    // Audio data
                    const offset = 44;
                    for (let i = 0; i < renderedBuffer.length; i++) {
                        for (let channel = 0; channel < numberOfChannels; channel++) {
                            const sample = renderedBuffer.getChannelData(channel)[i];
                            const value = Math.max(-1, Math.min(1, sample));
                            view.setInt16(offset + (i * numberOfChannels + channel) * 2, value * 0x7FFF, true);
                        }
                    }

                    resolve(new Blob([buffer], { type: 'audio/wav' }));
                });

                return wavBlob;
            };

            // Helper function for WAV header
            const writeString = (view: DataView, offset: number, string: string) => {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            };

            // Process frames and audio chunks
            for (let i = 0; i < numSamples; i++) {
                const startTime = i * sampleInterval;
                const endTime = Math.min((i + 1) * sampleInterval, duration);

                // Create document for this segment
                const document = await createLectureDocument(lecture.id, i + 1, "");
                if (!document.success || !document.documentId) {
                    throw new Error(`Failed to create document for segment ${i + 1}`);
                }

                // Extract and upload frame
                const frameBlob = await extractFrame(startTime);
                const frameUploadPath = `${classId}/${lecture.id}/${document.documentId}.png`;
                await supabase.storage
                    .from("lectures")
                    .upload(frameUploadPath, frameBlob, {
                        cacheControl: '3600',
                        upsert: true
                    });

                // Extract and upload audio chunk
                const audioBlob = await extractAudioChunk(startTime, endTime);
                const audioUploadPath = `${classId}/${lecture.id}/${document.documentId}.wav`;
                await supabase.storage
                    .from("lectures")
                    .upload(audioUploadPath, audioBlob, {
                        cacheControl: '3600',
                        upsert: true
                    });
            }
            // dont wait for this to finish
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/parse/lecture`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lecture_id: lecture.id,
                })
            });

            // Cleanup
            URL.revokeObjectURL(videoUrl);
            await audioContext.close();

            return lecture.id;

        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    };

    const getProgress = useMemo(() => {
        return (lectureId: string, uploading: boolean = false) => {
            if (!documents || !lectures) return 0;
            const lectureDocuments = documents.filter(document =>
                document.lecture === lectureId && (uploading || document.processed)
            );
            const lecture = lectures.find(lecture => lecture.id === lectureId);
            if (!lecture || lecture.pages === 0) return 0;
            if (lecture.upload_progress !== 1) return lecture.upload_progress * 100;
            return (lectureDocuments.length / lecture.pages) * 100;
        };
    }, [documents, lectures]);

    const getEstimatedTime = useMemo(() => {
        return (lectureId: string, uploading: boolean = false) => {
            const lecture = lectures?.find(lecture => lecture.id === lectureId);
            if (!lecture || lecture.pages === 0) return 0;
            return Number(((lecture.pages * 4)) * (100 - getProgress(lectureId, uploading)) / 100).toFixed(2);
        };
    }, [documents, lectures]);

    const handleRetry = async (classId: string, lecture: Lecture) => {
        try {
            setParsingLectures(prev => new Set(prev).add(lecture.id));
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/parse/lecture`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lecture_id: lecture.id,
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error retrying:', error);
            notifications.show({
                title: 'Error',
                message: `Failed to retry parsing. Please try again.`,
                color: 'red'
            });
        } finally {
            setParsingLectures(prev => {
                const next = new Set(prev);
                next.delete(lecture.id);
                return next;
            });
        }
    };

    const getDocumentImage = (lectureId: string) => {
        if (!lectureId) return '/placeholder_image.svg';
        const filteredDocuments = documents?.filter(document => document?.lecture === lectureId);
        if (!filteredDocuments) return '/placeholder_image.svg';
        const document = (filteredDocuments.length > 1 && classId === "ae333215-2914-4026-8aae-418f1255cdd0") ? filteredDocuments[1] : filteredDocuments[0]; // using the second page if it exists since first one is the cover page
        if (!document) return '/placeholder_image.svg';
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${classId}/${document.lecture}/${document.id}.png`
    }

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
                        console.log("Lecture:", newLecture);
                        // Update your lectures state with the new data
                        queryClient.setQueryData(["lectures", classId], (oldData: Lecture[]) => {
                            return [...oldData, newLecture];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedLecture = payload.new as Lecture;
                        console.log("Updated Lecture:", updatedLecture);
                        queryClient.setQueryData(["lectures", classId], (oldData: Lecture[]) => {
                            return oldData.map(lecture => lecture.id === updatedLecture.id ? updatedLecture : lecture);
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
        if (!lectures) return;
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
                (payload) => {
                    console.log("Document change:", payload);

                    // Immediately invalidate the documents query to trigger a refresh
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

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            {/* <Link href={`/classes/${classId}`}>
                                <IconArrowLeft size={24} color={colorScheme === "dark" ? "white" : "black"} style={{ cursor: "pointer" }} />
                            </Link> */}
                            <Text size="xl" fw={700} mb={6} pl={4}>Lectures</Text>
                        </Group>
                        <Group>
                            <Button onClick={() => fileInputRef.current?.click()} leftSection={<IconUpload size={14} />}>Upload Lectures</Button>
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
                        {(lectures && documents && classData) && lectures.length > 0 && lectures.sort((a, b) => (b.note_number ?? 0) - (a.note_number ?? 0)).map((lecture) => {
                            if (lecture.parse_status !== "complete") {
                                return (
                                    <Card withBorder key={lecture.id}>
                                        <Group align="flex-start" justify="space-between">
                                            <Group align="flex-start">
                                                <Image
                                                    src={getDocumentImage(lecture.id)}
                                                    alt={`First page of ${lecture.name}`}
                                                    width={150}
                                                    height={150}
                                                    style={{ objectFit: "contain", borderRadius: "10px" }}
                                                />
                                                <Stack gap="xs">
                                                    <Text size="lg" fw={500}>{lecture.name}</Text>
                                                    <Text size="sm" c="dimmed">
                                                        {lecture.parse_status === 'parsing' ? 'Parsing...' :
                                                            lecture.parse_status === 'error' ? 'Parse failed' :
                                                                lecture.parse_status === 'idle' ? 'Waiting to parse' :
                                                                    'Could not find any topics.'}
                                                    </Text>
                                                    {lecture.parse_error && (
                                                        <Text size="sm" c="red">
                                                            Error: {lecture.parse_error}
                                                        </Text>
                                                    )}
                                                    <Progress
                                                        value={getProgress(lecture.id, lecture.parse_status !== 'parsing')}
                                                        size="sm"
                                                        color="blue"
                                                        animated={lecture.parse_status === 'parsing'}
                                                        striped={lecture.parse_status === 'parsing'}
                                                    />
                                                    {(lecture.parse_status === 'parsing') && (
                                                        <Text size="sm" c="dimmed">
                                                            Estimated time remaining: ~{getEstimatedTime(lecture.id, lecture.parse_status !== 'parsing')} seconds
                                                        </Text>
                                                    )}
                                                </Stack>
                                            </Group>
                                            <Button
                                                variant="light"
                                                color="blue"
                                                onClick={() => handleRetry(classId, lecture)}
                                                leftSection={<IconRefresh size={16} />}
                                                disabled={lecture.parse_status === 'parsing' || lecture.parse_status === 'idle'}
                                                loading={parsingLectures.has(lecture.id)}
                                            >
                                                {parsingLectures.has(lecture.id) ? 'Retrying...' :
                                                    lecture.parse_status === 'parsing' ? 'Parsing...' :
                                                        lecture.parse_status === 'error' ? 'Retry' :
                                                            'Processing...'}
                                            </Button>
                                        </Group>
                                    </Card>
                                )
                            }
                            return (
                                <Link
                                    href={`/classes/c/${classId}/lecture/${lecture.id}`}
                                    key={lecture.id}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <Card withBorder>
                                        <Group align="flex-start">
                                            <Image
                                                src={getDocumentImage(lecture.id)}
                                                alt={`First page of ${lecture.name}`}
                                                width={150}
                                                height={150}
                                                style={{ objectFit: "contain", borderRadius: "10px" }}
                                            />
                                            <Stack gap="xs">
                                                <Text size="lg" fw={500}>{lecture.name}</Text>
                                                <Text size="sm" c="dimmed">
                                                    Uploaded {new Date(lecture.created_at ?? "").toLocaleDateString()}
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
        </ClassLayout>
    );
}