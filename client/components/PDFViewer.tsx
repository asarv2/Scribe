'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button, Stack, Group } from '@mantine/core';

type PDFViewerProps = {
    pdfUrl: string;
    pageNumber: number;
    setPageNumber: React.Dispatch<React.SetStateAction<number>>;
};

export default function PDFViewer({ pdfUrl, pageNumber, setPageNumber }: PDFViewerProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const renderTaskRef = useRef<any>(null); // Ref to store the current render task.
    const [numPages, setNumPages] = useState(0);
    const [pdfDoc, setPdfDoc] = useState<any>(null);

    useEffect(() => {
        let isCancelled = false;

        (async function () {
            try {
                // Import pdfjs-dist dynamically for client-side rendering.
                const pdfJS = await import('pdfjs-dist');

                // Set up the worker source.
                pdfJS.GlobalWorkerOptions.workerSrc =
                    window.location.origin + '/pdf.worker.min.mjs'; // Ensure this path is correct for your setup.

                // Load the PDF document.
                const loadedPdf = await pdfJS.getDocument(pdfUrl).promise;
                if (!isCancelled) {
                    setPdfDoc(loadedPdf);
                    setNumPages(loadedPdf.numPages);
                }
            } catch (error) {
                console.error('Error loading PDF:', error);
            }
        })();

        // Cleanup function to cancel the render task if the component unmounts.
        return () => {
            isCancelled = true;
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [pdfUrl]);

    // Effect to render the page whenever pageNumber changes
    useEffect(() => {
        if (pdfDoc) {
            renderPage(pageNumber);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageNumber]);

    const renderPage = async (pageNumber: number) => {
        if (!pdfDoc) return;
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const canvasContext = canvas.getContext('2d');
        if (!canvasContext) return;

        // Resize canvas to match the page's dimensions.
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Cancel any previous render task.
        if (renderTaskRef.current) {
            await renderTaskRef.current.promise;
        }

        // Render the page into the canvas.
        const renderContext = { canvasContext, viewport };
        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        try {
            await renderTask.promise;
        } catch (error: any) {
            if (error.name === 'RenderingCancelledException') {
                console.log('Rendering cancelled.');
            } else {
                console.error('Render error:', error);
            }
        }
    };

    const handlePrevPage = () => {
        if (pageNumber <= 1) return;
        setPageNumber(pageNumber - 1);
    };

    const handleNextPage = () => {
        if (pageNumber >= numPages) return;
        setPageNumber(pageNumber + 1);
    };

    return (
        <Stack>
            <Stack align="center">
                <canvas ref={canvasRef} style={{ width: '50%', border: '1px solid black' }} />
            </Stack>
            <Group>
                <Button onClick={handlePrevPage} disabled={pageNumber <= 1}>
                    Previous
                </Button>
                <Button onClick={handleNextPage} disabled={pageNumber >= numPages}>
                    Next
                </Button>
                <span>
                    Page {pageNumber} of {numPages}
                </span>
            </Group>
        </Stack>
    );
}
