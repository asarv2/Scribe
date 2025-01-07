/**
 * DownloadGenerationModal.tsx
 * Modal to download a generation as a PDF
 * @AshokSaravanan222
 * 11-15-2024
 */

import { Button, Input, Modal, Stack, Tabs, TabsList, TabsPanel, TabsTab, Text, Textarea, Tooltip } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { User } from "@supabase/supabase-js"
import { IconDownload, IconPlus, IconTrash, IconCopy } from "@tabler/icons-react"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { uploadLectureImages } from "@/utils/services/storage"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { isProfessor } from "@/utils/lecture/isProfessor"
import { deleteLecture } from "@/utils/services/lecture"
import { deleteGeneration } from "@/utils/services/generation"
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';
import { usePDF } from 'react-to-pdf';

type DownloadGenerationModalProps = {
    classId: string
    generationId: string
    generationTitle: string
    generationLatex: string
    user: User | undefined
}

export default function DownloadGenerationModal({ generationId, user, generationTitle, classId, generationLatex }: DownloadGenerationModalProps) {
    const [opened, { open, close }] = useDisclosure(false);
    const { toPDF, targetRef } = usePDF({ filename: `${generationTitle}.pdf` });

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        notifications.show({
            title: 'Copied!',
            message: 'Content copied to clipboard',
            color: 'green'
        });
    };

    const downloadTxt = () => {
        const element = document.createElement("a");
        const file = new Blob([generationLatex], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = `${generationTitle}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const downloadTex = () => {
        const element = document.createElement("a");
        const file = new Blob([generationLatex], { type: 'application/x-tex' });
        element.href = URL.createObjectURL(file);
        element.download = `${generationTitle}.tex`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    return (
        <>
            {isProfessor(user, classId) && <Tooltip label="Download Generation"><IconDownload size={24} color="black" style={{ cursor: "pointer" }} onClick={open} /></Tooltip>}

            <Modal opened={opened} onClose={close} title={`Download Generation for ${generationTitle}`} centered size="lg">
                <Stack>
                    <Tabs defaultValue="txt">
                        <TabsList>
                            <TabsTab value="txt">txt</TabsTab>
                            <TabsTab value="tex">tex</TabsTab>
                            <TabsTab value="pdf">pdf</TabsTab>
                        </TabsList>
                        
                        <TabsPanel value="txt">
                            <Stack>
                                <Textarea value={generationLatex} maxRows={15} readOnly autosize />
                                <Stack>
                                    <Button leftSection={<IconCopy size={16} />} onClick={() => handleCopy(generationLatex)}>
                                        Copy
                                    </Button>
                                    <Button leftSection={<IconDownload size={16} />} onClick={downloadTxt}>
                                        Download .txt
                                    </Button>
                                </Stack>
                            </Stack>
                        </TabsPanel>

                        <TabsPanel value="tex">
                            <Stack>
                                <Textarea value={generationLatex} maxRows={15} readOnly autosize />
                                <Stack>
                                    <Button leftSection={<IconCopy size={16} />} onClick={() => handleCopy(generationLatex)}>
                                        Copy
                                    </Button>
                                    <Button leftSection={<IconDownload size={16} />} onClick={downloadTex}>
                                        Download .tex
                                    </Button>
                                </Stack>
                            </Stack>
                        </TabsPanel>

                        <TabsPanel value="pdf">
                            <Stack>
                                <div ref={targetRef} style={{ padding: '20px', maxHeight: '400px', overflowY: 'auto' }}>
                                    <Latex>{generationLatex}</Latex>
                                </div>
                                <Button leftSection={<IconDownload size={16} />} onClick={() => toPDF()}>
                                    Download PDF
                                </Button>
                            </Stack>
                        </TabsPanel>
                    </Tabs>
                </Stack>
            </Modal>
        </>
    )
}