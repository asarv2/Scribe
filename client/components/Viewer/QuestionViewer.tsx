/**
 * SummaryViewer.tsx
 * Used to view summary document
 * 03/20/2025
 */

import React from 'react';
import { Question } from '../../types';
import { Card } from '@mantine/core';
import Latex from '../Latex';

interface QuestionViewerProps {
    question: Question;
}

const QuestionViewer: React.FC<QuestionViewerProps> = ({ question }) => {
    return (
        <Card withBorder p="md">
            <Latex>{question.problem}</Latex>
            <Latex>{question.solution}</Latex>
        </Card>
    );
};

export default QuestionViewer;
