/**
 * SummaryViewer.tsx
 * Used to view summary document
 * 03/20/2025
 */

import React from 'react';
import { Question } from '../../types';
import { Card, Menu, ActionIcon, Group, Text } from '@mantine/core';
import { IconDownload, IconFile, IconFileText, IconFileTypography } from '@tabler/icons-react';
import Latex from '../Latex';
import { getQuestionPDFUrl, getQuestionTeXUrl, getQuestionTextUrl } from '../../utils/services/images';

interface QuestionViewerProps {
    question: Question;
}

const QuestionViewer: React.FC<QuestionViewerProps> = ({ question }) => {
    return (
        <Card withBorder p="md">
            <Group justify="space-between" mb="md">
                <Text c="dimmed">Question ID: {question.id}</Text>
                <Menu position="bottom-end" shadow="md">
                    <Menu.Target>
                        <ActionIcon>
                            <IconDownload size={18} />
                        </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Label>Download as</Menu.Label>
                        <Menu.Item 
                            leftSection={<IconFile size={14} />}
                            component="a"
                            href={getQuestionPDFUrl(question.id)}
                            download
                        >
                            PDF Document
                        </Menu.Item>
                        <Menu.Item 
                            leftSection={<IconFileTypography size={14} />}
                            component="a"
                            href={getQuestionTeXUrl(question.id)}
                            download
                        >
                            LaTeX Source
                        </Menu.Item>
                        <Menu.Item 
                            leftSection={<IconFileText size={14} />}
                            component="a"
                            href={getQuestionTextUrl(question.id)}
                            download
                        >
                            Plain Text
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </Group>
            
            <Latex>{question.problem}</Latex>
            <Latex>{question.solution}</Latex>
        </Card>
    );
};

export default QuestionViewer;
