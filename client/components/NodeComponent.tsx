/**
 * NodeComponent.tsx
 * Will be used to show each of the individual nodes in the mindmap
 * @AshokSaravanan222
 * 11-12-2024
 */

import React from 'react'
import { Handle, NodeProps, Position } from 'reactflow'

export const NodeComponent: React.FC<NodeProps> = ({ data }) => {
    return (
        <>
            <Handle type="target" position={Position.Top} />
            <div
                style={{
                    background: "#fff",
                    padding: "12px",
                    borderTopRightRadius: "8px",
                    borderTopLeftRadius: "8px",
                    borderBottom: `solid 8px ${data.color ?? "#000"}`,
                    boxShadow: "0 0 8px rgba(0, 0, 0, 0.2)",
                    fontSize: "16px",
                    fontWeight: "bold",
                }}
            >
                {data.label}
            </div>
            <Handle type="source" position={Position.Bottom} />
        </>
    )
}