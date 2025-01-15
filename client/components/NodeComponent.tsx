import { Handle, NodeProps, Position as FlowPosition } from '@xyflow/react';
import React from 'react';
import Latex from '@/components/Latex';

export const NodeComponent: React.FC<NodeProps> = ({ data}) => {
    return (
        <div style={{ position: "relative", width: "300px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <Handle type="target" position={FlowPosition.Top} />
            <div
                style={{
                    background: '#fff',
                    padding: '12px',
                    borderTopRightRadius: '8px',
                    borderTopLeftRadius: '8px',
                    borderBottom: `solid 8px ${data.color ?? '#000'}`,
                    boxShadow: '0 0 8px rgba(0, 0, 0, 0.2)',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    display: 'inline-block', // Add this line
                    whiteSpace: 'nowrap',    // Add this line if text wraps unexpectedly
                }}
            >
                <Latex>{data.label as string}</Latex>
            </div>
            <Handle type="source" position={FlowPosition.Bottom} />
        </div>
    );
};
