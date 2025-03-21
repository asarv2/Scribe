/**
 * SummaryViewer.tsx
 * Used to view summary document
 * 03/20/2025
 */

import React from 'react';
import { Summary } from '../../types';
import { Card } from '@mantine/core';
import Latex from '../Latex';

interface SummaryViewerProps {
    summary: Summary;
}

const SummaryViewer: React.FC<SummaryViewerProps> = ({ summary }) => {
    return (
        <Card withBorder p="md">
            <Latex>{summary.preamble}</Latex>
            <Latex>{summary.body}</Latex>
            <Latex>{summary.conclusion}</Latex>
        </Card>
    );
};

export default SummaryViewer;
