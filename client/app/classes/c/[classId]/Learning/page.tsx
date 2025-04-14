/**
 * app/classes/c/[classId]/Learning/page.tsx
 * Page for professors to manage learning outcomes and objects and link them together
 * @AshokSaravanan222
 * 05.01.2025
 */
"use client"

import { use, useState, useCallback, useEffect, useRef } from "react";
import { ClassLayout } from "@/components/Class/ClassLayout";
import { 
  Container, Title, Text, Paper, Stack, Group, Button, 
  Modal, TextInput, ActionIcon, Badge, Slider 
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import ReactFlow, { 
    Background, Node, Edge, Connection,
    addEdge, useNodesState, useEdgesState, ReactFlowProvider, 
    Handle, Position, useReactFlow
} from 'react-flow-renderer';
import 'reactflow/dist/style.css';
import { IconPlus, IconEdit } from '@tabler/icons-react';

// Custom node components
const OutcomeNode = ({ data, id }) => (
  <Paper 
    p="md" 
    radius="md" 
    withBorder 
    style={{ 
      background: 'transparent', 
      width: 250, 
      border: '2px solid #4dabf7',
      textAlign: 'center',
      position: 'relative'
    }}
    onClick={(e) => {
      e.stopPropagation();
      if (typeof data.onNodeClick === 'function') {
        data.onNodeClick(id);
      }
    }}
  >
    {data.isEditable && (
      <ActionIcon 
        color="blue" 
        variant="subtle" 
        onClick={(e) => {
          e.stopPropagation();
          if (typeof data.onEdit === 'function') {
            data.onEdit(id);
          }
        }}
        style={{ position: 'absolute', top: 8, right: 8 }}
        size="sm"
      >
        <IconEdit size={16} />
      </ActionIcon>
    )}
    <Stack gap="xs" align="center">
      <Badge color="blue" size="sm" variant="transparent">{data.title}</Badge>
      {data.description && data.description !== 'No description' && (
        <Text size="sm" lineClamp={3} color="dimmed" ta="center">
          {data.description}
        </Text>
      )}
    </Stack>
    <Handle 
      type="source" 
      position={Position.Right} 
      style={{ background: '#4dabf7' }}
      id={`${id}-right-source`}
    />
    <Handle 
      type="target" 
      position={Position.Left} 
      style={{ background: '#4dabf7' }}
      id={`${id}-left-target`}
    />
    <Handle 
      type="source" 
      position={Position.Bottom} 
      style={{ background: '#4dabf7' }}
      id={`${id}-bottom-source`}
    />
    <Handle 
      type="target" 
      position={Position.Top} 
      style={{ background: '#4dabf7' }}
      id={`${id}-top-target`}
    />
  </Paper>
);

const ObjectiveNode = ({ data, id }) => (
  <Paper 
    p="md" 
    radius="md" 
    withBorder 
    style={{ 
      background: 'transparent', 
      width: 250, 
      border: '2px solid #fd7e14',
      textAlign: 'center',
      position: 'relative'
    }}
    onClick={(e) => {
      e.stopPropagation();
      if (typeof data.onNodeClick === 'function') {
        data.onNodeClick(id);
      }
    }}
  >
    {data.isEditable && (
      <ActionIcon 
        color="orange" 
        variant="subtle" 
        onClick={(e) => {
          e.stopPropagation();
          if (typeof data.onEdit === 'function') {
            data.onEdit(id);
          }
        }}
        style={{ position: 'absolute', top: 8, right: 8 }}
        size="sm"
      >
        <IconEdit size={16} />
      </ActionIcon>
    )}
    <Stack gap="xs" align="center">
      <Badge color="orange" size="sm" variant="transparent">{data.title}</Badge>
      {data.description && data.description !== 'No description' && (
        <Text size="sm" lineClamp={3} color="dimmed" ta="center">
          {data.description}
        </Text>
      )}
    </Stack>
    <Handle 
      type="source" 
      position={Position.Right} 
      style={{ background: '#fd7e14' }}
      id={`${id}-right-source`}
    />
    <Handle 
      type="target" 
      position={Position.Left} 
      style={{ background: '#fd7e14' }}
      id={`${id}-left-target`}
    />
    <Handle 
      type="source" 
      position={Position.Bottom} 
      style={{ background: '#fd7e14' }}
      id={`${id}-bottom-source`}
    />
    <Handle 
      type="target" 
      position={Position.Top} 
      style={{ background: '#fd7e14' }}
      id={`${id}-top-target`}
    />
  </Paper>
);

// Node type to component mapping
const nodeTypes = {
  outcome: OutcomeNode,
  objective: ObjectiveNode,
};

// Updated zoom controls component with minus and plus indicators
const ZoomControls = () => {
    const { zoomIn, zoomOut, setViewport, getViewport } = useReactFlow();
    const [zoom, setZoom] = useState(1); // Initial zoom level
    
    // Initialize zoom value from ReactFlow on mount
    useEffect(() => {
        const viewport = getViewport();
        if (viewport) {
            setZoom(viewport.zoom);
        }
    }, [getViewport]);
    
    // Update zoom when slider changes
    const handleZoomChange = (newZoom: number) => {
        setZoom(newZoom);
        // Get current viewport to maintain position
        const { x, y } = getViewport();
        // Set new viewport with updated zoom
        setViewport({ x, y, zoom: newZoom });
    };
    
    return (
        <div 
            style={{ 
                position: 'absolute', 
                bottom: '10px', 
                left: '10px',
                width: '180px',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}
        >
            <Text size="xs" fw={500} c="#4dabf7" style={{ opacity: 0.9 }}>−</Text>
            <Slider
                min={0.1}
                max={2}
                step={0.05}
                value={zoom}
                onChange={handleZoomChange}
                size="sm"
                color="blue"
                label={null}
                styles={{
                    track: { backgroundColor: 'rgba(225, 225, 225, 0.6)' },
                    thumb: { borderColor: '#4dabf7', backgroundColor: 'white' },
                    bar: { backgroundColor: '#4dabf7' }
                }}
                style={{ flex: 1 }}
            />
            <Text size="xs" fw={500} c="#4dabf7" style={{ opacity: 0.9 }}>+</Text>
        </div>
    );
};

// Add the ViewportIndicator component
const ViewportIndicator = () => {
  const { getViewport, getNodes } = useReactFlow();
  const [angle, setAngle] = useState(0);
  const [showIndicator, setShowIndicator] = useState(false);
  
  // Check if any nodes are outside the viewport and calculate direction
  useEffect(() => {
    const checkNodesOutsideViewport = () => {
      const nodes = getNodes();
      if (nodes.length === 0) return;
      
      const viewport = getViewport();
      const { x, y, zoom } = viewport;
      
      // Get viewport dimensions
      const container = document.querySelector('.react-flow__renderer');
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const viewportWidth = containerRect.width / zoom;
      const viewportHeight = containerRect.height / zoom;
      
      // Viewport boundaries
      const leftBoundary = -x / zoom;
      const rightBoundary = leftBoundary + viewportWidth;
      const topBoundary = -y / zoom;
      const bottomBoundary = topBoundary + viewportHeight;
      
      // Viewport center point
      const centerX = leftBoundary + viewportWidth / 2;
      const centerY = topBoundary + viewportHeight / 2;
      
      // Track nodes outside viewport and their positions
      let outsideNodes = [];
      
      for (const node of nodes) {
        const { position, width, height } = node;
        const nodeX = position.x + (width ?? 250) / 2;
        const nodeY = position.y + (height ?? 150) / 2;
        
        // Check if node is outside viewport
        if (
          nodeX < leftBoundary || 
          nodeX > rightBoundary || 
          nodeY < topBoundary || 
          nodeY > bottomBoundary
        ) {
          outsideNodes.push({ x: nodeX, y: nodeY });
        }
      }
      
      // Calculate direction to the center of mass of outside nodes
      if (outsideNodes.length > 0) {
        setShowIndicator(true);
        
        // Calculate the center of mass of outside nodes
        const comX = outsideNodes.reduce((sum, node) => sum + node.x, 0) / outsideNodes.length;
        const comY = outsideNodes.reduce((sum, node) => sum + node.y, 0) / outsideNodes.length;
        
        // Calculate angle from viewport center to center of mass (in radians)
        const deltaX = comX - centerX;
        const deltaY = comY - centerY;
        
        // Calculate angle in degrees (0 = right, 90 = down, 180 = left, 270 = up)
        const angleRadians = Math.atan2(deltaY, deltaX);
        const angleDegrees = (angleRadians * 180 / Math.PI);
        
        setAngle(angleDegrees);
      } else {
        setShowIndicator(false);
      }
    };
    
    // Run check initially and on viewport changes
    checkNodesOutsideViewport();
    
    // Add event listeners to detect viewport changes
    const viewportEl = document.querySelector('.react-flow__viewport');
    if (viewportEl) {
      // Use MutationObserver to detect style changes (pan/zoom)
      const observer = new MutationObserver(checkNodesOutsideViewport);
      observer.observe(viewportEl, { attributes: true });
      
      return () => observer.disconnect();
    }
  }, [getViewport, getNodes]);
  
  // Only show indicator if nodes are outside viewport
  if (!showIndicator) return null;
  
  return (
    <div 
      style={{ 
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '60px',
        height: '60px',
        background: 'rgba(255, 255, 255, 0.85)',
        borderRadius: '50%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.2)',
        zIndex: 5,
        pointerEvents: 'none'
      }}
    >
      <div 
        style={{ 
          width: '30px',
          height: '30px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transform: `rotate(${angle}deg)`,
          transition: 'transform 0.3s ease-out',
          color: '#4dabf7',
          fontSize: '24px'
        }}
      >
        ➤
      </div>
    </div>
  );
};

export default function LearningPage({ params }: { params: Promise<{ classId: string }> }) {
    const { classId } = use(params);
    const [opened, { open, close }] = useDisclosure(false);
    const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
    const [nodeForm, setNodeForm] = useState({
      type: 'outcome',
      title: '',
      description: '',
    });
    const [editingNode, setEditingNode] = useState<Node | null>(null);
    
    // Local data storage instead of Supabase
    const [outcomes, setOutcomes] = useState<any[]>([]);
    const [objectives, setObjectives] = useState<any[]>([]);
    const [connections, setConnections] = useState<any[]>([]);
    const [isAdmin, setIsAdmin] = useState(true); // Set to true for simplicity
    
    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [connectingMode, setConnectingMode] = useState(false);
    const [connectionSource, setConnectionSource] = useState(null);
    
    // Add state variables to track adding state
    const [addingOutcome, setAddingOutcome] = useState(false);
    const [addingObjective, setAddingObjective] = useState(false);
    const [newNodeTitle, setNewNodeTitle] = useState('');

    // Define isProfessorOrAdmin function - always returns true for simplicity
    const isProfessorOrAdmin = useCallback(() => {
        return true;
    }, []);

    // Use refs to keep handler functions stable
    const handleNodeClickRef = useRef<((nodeId: string) => void) | null>(null);
    const handleEditNodeRef = useRef<((nodeId: string) => void) | null>(null);

    // Wrap handleEditNode in useCallback with minimal dependencies
    const handleEditNode = useCallback((nodeId) => {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        setEditingNode(node);
        setNodeForm({
          type: node.type || 'outcome',
          title: node.data.title,
          description: node.data.description || ''
        });
        openEdit();
      }
    }, [nodes, openEdit]);

    // Use a ref to keep handleEditNode stable across renders
    useEffect(() => {
      handleEditNodeRef.current = handleEditNode;
    }, [handleEditNode]);

    // Function to initialize node click handler
    useEffect(() => {
      const handleNodeClick = (nodeId) => {
        if (connectingMode) {
          if (connectionSource === null) {
            // First node clicked, set as source
            setConnectionSource(nodeId);
            
            // Highlight the node as selected source
            setNodes((nds) => nds.map((node) => {
              if (node.id === nodeId) {
                return {
                  ...node,
                  style: { ...node.style, boxShadow: '0 0 10px 2px #4dabf7' }
                };
              }
              return node;
            }));
          } else if (connectionSource !== nodeId) {
            // Second node clicked, create connection
            const sourceNode = nodes.find(n => n.id === connectionSource);
            const targetNode = nodes.find(n => n.id === nodeId);
            
            if (sourceNode && targetNode) {
              const newConnectionId = `edge-${Date.now()}`;
              
              // We'll let React Flow handle the connection via onConnect instead
              // which properly handles the source/target handles
              setConnectingMode(false);
              setConnectionSource(null);
            }
            
            // Reset connection source and remove highlight
            setNodes((nds) => nds.map((node) => {
              if (node.id === connectionSource) {
                return {
                  ...node,
                  style: { ...node.style, boxShadow: 'none' }
                };
              }
              return node;
            }));
          }
        } else {
          // Normal node selection
          const node = nodes.find(n => n.id === nodeId);
          if (node) {
            setSelectedNode(node);
          }
        }
      };
      
      handleNodeClickRef.current = handleNodeClick;
    }, [nodes, connectingMode, connectionSource, setNodes, setConnections, classId]);

    // Function for handling node position changes
    const onNodesChangeWithSave = useCallback((changes) => {
        // Apply the changes locally
        onNodesChange(changes);
        
        // Then for each position change, update our local state
        for (const change of changes) {
            if (change.type === 'position' && change.position) {
                // Find the node
                const node = nodes.find(n => n.id === change.id);
                if (!node) continue;
                
                // Update position in local state
                if (node.type === 'outcome') {
                    setOutcomes(prev => prev.map(outcome => 
                        outcome.id === node.id 
                            ? {...outcome, position_x: change.position.x, position_y: change.position.y} 
                            : outcome
                    ));
                } else if (node.type === 'objective') {
                    setObjectives(prev => prev.map(objective => 
                        objective.id === node.id 
                            ? {...objective, position_x: change.position.x, position_y: change.position.y} 
                            : objective
                    ));
                }
            }
        }
    }, [nodes, onNodesChange, setOutcomes, setObjectives]);

    // Update onConnect to work with local state and preserve handle IDs
    const onConnect = useCallback((params) => {
        try {
            // Find source and target nodes to determine their types
            const sourceNode = nodes.find(n => n.id === params.source);
            const targetNode = nodes.find(n => n.id === params.target);
            
            if (!sourceNode || !targetNode) return;
            
            const newConnectionId = `edge-${Date.now()}`;
            
            // Add edge directly, preserving source and target handles
            setEdges((eds) => addEdge({ 
                ...params, 
                id: newConnectionId,
                animated: true, 
                style: { stroke: '#999' },
                // Explicitly include these to ensure they're preserved
                sourceHandle: params.sourceHandle,
                targetHandle: params.targetHandle
            }, eds));
            
            // Add to local connections state
            setConnections(prev => [...prev, {
                id: newConnectionId,
                source_id: params.source,
                source_type: sourceNode.type,
                target_id: params.target,
                target_type: targetNode.type,
                source_handle: params.sourceHandle,
                target_handle: params.targetHandle,
                class_id: classId
            }]);
            
            setConnectingMode(false);
            setConnectionSource(null);
        } catch (error) {
            console.error("Error in onConnect:", error);
        }
    }, [nodes, setEdges, setConnections, classId, setConnectingMode, setConnectionSource]);


    
    // Convert local data to nodes and edges
    useEffect(() => {
        if (outcomes.length > 0 || objectives.length > 0 || connections.length > 0) {
            // Convert outcomes to nodes
            const outcomeNodes = outcomes.map(outcome => ({
                id: outcome.id,
                type: 'outcome',
                position: { x: outcome.position_x || 0, y: outcome.position_y || 0 },
                data: { 
                    title: outcome.title, 
                    description: outcome.description || '',
                    isEditable: isProfessorOrAdmin(),
                    onEdit: handleEditNodeRef.current,
                    onNodeClick: handleNodeClickRef.current
                }
            }));
            
            // Convert objectives to nodes
            const objectiveNodes = objectives.map(objective => ({
                id: objective.id,
                type: 'objective',
                position: { x: objective.position_x || 0, y: objective.position_y || 0 },
                data: { 
                    title: objective.title, 
                    description: objective.description || '',
                    isEditable: isProfessorOrAdmin(),
                    onEdit: handleEditNodeRef.current,
                    onNodeClick: handleNodeClickRef.current
                }
            }));
            
            // Combine nodes
            setNodes([...outcomeNodes, ...objectiveNodes]);
            
            // Convert connections to edges - with handle information
            const connectionEdges = connections.map(connection => ({
                id: connection.id,
                source: connection.source_id,
                target: connection.target_id,
                sourceHandle: connection.source_handle,
                targetHandle: connection.target_handle,
                animated: true,
                style: { stroke: '#999' }
            }));
            
            setEdges(connectionEdges);
        }
    }, [outcomes, objectives, connections, isProfessorOrAdmin]);

    // Update updateNode to work with local state
    const updateNode = async () => {
      if (!nodeForm.title || !editingNode) return;
      
      try {
        // Update in local state first
        if (editingNode.type === 'outcome') {
          setOutcomes(prev => prev.map(outcome => 
            outcome.id === editingNode.id
                ? {...outcome, title: nodeForm.title, description: nodeForm.description || ''}
                : outcome
          ));
        } else {
          setObjectives(prev => prev.map(objective => 
            objective.id === editingNode.id
                ? {...objective, title: nodeForm.title, description: nodeForm.description || ''}
                : objective
          ));
        }
        
        // Then update node display state
        setNodes((nds) => nds.map((node) => {
          if (node.id === editingNode.id) {
            return {
              ...node,
              data: {
                ...node.data,
                title: nodeForm.title,
                description: nodeForm.description || '',
                onEdit: handleEditNodeRef.current,
                onNodeClick: handleNodeClickRef.current
              }
            };
          }
          return node;
        }));

        setNodeForm({ type: 'outcome', title: '', description: '' });
        closeEdit();
      } catch (error) {
        console.error("Error updating node:", error);
      }
    };

    // Update removeNode to work with local state
    const removeNode = async (nodeId) => {
      try {
        // Find the node to determine its type
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        // Delete from local state first
        if (node.type === 'outcome') {
          setOutcomes(prev => prev.filter(outcome => outcome.id !== nodeId));
        } else {
          setObjectives(prev => prev.filter(objective => objective.id !== nodeId));
        }
        
        // Also delete any connections that use this node
        const relatedConnections = connections.filter(
          conn => conn.source_id === nodeId || conn.target_id === nodeId
        );
        
        setConnections(prev => prev.filter(
          conn => conn.source_id !== nodeId && conn.target_id !== nodeId
        ));
        
        // Then update display state
        setNodes((nds) => nds.filter(node => node.id !== nodeId));
        setEdges((eds) => eds.filter(edge => 
          edge.source !== nodeId && edge.target !== nodeId
        ));
      } catch (error) {
        console.error("Error removing node:", error);
      }
    };

    // Function to start the adding process
    const startAddingNode = (type) => {
      if (type === 'outcome') {
        setAddingOutcome(true);
        setAddingObjective(false);
      } else {
        setAddingOutcome(false);
        setAddingObjective(true);
      }
      setNewNodeTitle('');
    };

    // Update confirmAddNode to work with local state
    const confirmAddNode = async (type) => {
      if (!newNodeTitle.trim()) return;
      
      try {
        const position = {
          x: Math.random() * 300,
          y: Math.random() * 300
        };

        // Create a new node ID
        const newId = `${type}-${Date.now()}`;
        
        // Add to local state first
        const newNodeData = {
          id: newId,
          title: newNodeTitle.trim(),
          description: '',
          position_x: position.x,
          position_y: position.y,
          class: classId
        };
        
        if (type === 'outcome') {
          setOutcomes(prev => [...prev, newNodeData]);
        } else {
          setObjectives(prev => [...prev, newNodeData]);
        }

        // Then add to display state
        const newNode = {
          id: newId,
          type: type,
          position,
          data: { 
            title: newNodeTitle.trim(), 
            description: '', 
            isEditable: isProfessorOrAdmin(),
            onEdit: handleEditNodeRef.current,
            onNodeClick: handleNodeClickRef.current
          }
        };

        setNodes((nds) => [...nds, newNode]);
        setAddingOutcome(false);
        setAddingObjective(false);
        setNewNodeTitle('');
      } catch (error) {
        console.error("Error creating node:", error);
      }
    };

    // Function to cancel adding a node
    const cancelAddNode = () => {
      setAddingOutcome(false);
      setAddingObjective(false);
      setNewNodeTitle('');
    };

    // Filter nodes by type
    const outcomeNodes = nodes.filter(node => node.type === 'outcome');
    const objectiveNodes = nodes.filter(node => node.type === 'objective');

    return (
        <ClassLayout classId={classId}>
            <Container fluid h="calc(100vh - 120px)">
                <Title order={2} mb="md">Learning Outcomes & Objectives</Title>
                
                <div style={{ display: 'flex', height: 'calc(100vh - 180px)' }}>
                    {/* Left side - React Flow Canvas (75% width) */}
                    <div style={{ flex: '3', position: 'relative', marginRight: '16px' }}>
                        <Paper 
                            withBorder 
                            h="100%" 
                            style={{ position: 'relative' }}
                            bg="transparent"
                        >
                            <ReactFlowProvider>
                                <div style={{ height: '100%' }}>
                                    <ReactFlow
                                        nodes={nodes}
                                        edges={edges}
                                        onNodesChange={onNodesChangeWithSave}
                                        onEdgesChange={onEdgesChange}
                                        onConnect={onConnect}
                                        nodeTypes={nodeTypes}
                                        fitView
                                        connectionMode="strict"
                                        connectionLineType="bezier"
                                        style={{ background: 'transparent' }}
                                        proOptions={{ hideAttribution: true }}
                                        minZoom={0.1}
                                        maxZoom={2}
                                        defaultZoom={1}
                                        zoomOnScroll={true}
                                        panOnScroll={true}
                                        zoomOnDoubleClick={true}
                                    >
                                        <Background color="#e5e5e5" />
                                        <ZoomControls />
                                        <ViewportIndicator />
                                    </ReactFlow>
                                    <style jsx global>{`
                                        .react-flow__controls-button,
                                        .react-flow__attribution {
                                            display: none !important;
                                        }
                                    `}</style>
                                </div>
                            </ReactFlowProvider>
                        </Paper>
                    </div>
                    
                    {/* Right side - Lists (25% width) */}
                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
                        {/* Outcomes section (1/4 height) */}
                        <Paper 
                            withBorder 
                            style={{ flex: '1', marginBottom: '8px', overflow: 'auto', display: 'flex', flexDirection: 'column' }}
                            p="md"
                        >
                            <Group gap="apart" mb="xs">
                                <Title order={4} style={{ color: '#4dabf7' }}>Outcomes</Title>
                                {isProfessorOrAdmin() && (
                                    <ActionIcon 
                                        color="blue" 
                                        variant="light" 
                                        onClick={() => startAddingNode('outcome')}
                                        disabled={addingOutcome || addingObjective}
                                    >
                                        <IconPlus size={16} />
                                    </ActionIcon>
                                )}
                            </Group>
                            
                            <div style={{ overflow: 'auto', flex: '1' }}>
                                {addingOutcome && (
                                    <Paper 
                                        p="sm" 
                                        withBorder 
                                        style={{ 
                                            borderLeft: '3px solid #4dabf7',
                                            marginBottom: '8px'
                                        }}
                                    >
                                        <TextInput
                                            placeholder="Enter outcome name..."
                                            value={newNodeTitle}
                                            onChange={(e) => setNewNodeTitle(e.target.value)}
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && newNodeTitle.trim()) confirmAddNode('outcome');
                                                if (e.key === 'Escape') cancelAddNode();
                                            }}
                                        />
                                    </Paper>
                                )}
                                {outcomeNodes.length === 0 && !addingOutcome ? (
                                    <Text size="sm" color="dimmed" ta="center" mt="md">
                                        No outcomes yet. {isProfessorOrAdmin() ? '' : ''}
                                    </Text>
                                ) : (
                                    <Stack gap="xs">
                                        {outcomeNodes.map(node => (
                                            <Paper 
                                                key={node.id} 
                                                p="sm" 
                                                withBorder 
                                                style={{ 
                                                    borderLeft: node.id === selectedNode?.id ? 
                                                        '5px solid #4dabf7' : 
                                                        '3px solid #4dabf7',
                                                    cursor: 'pointer',
                                                    background: 'transparent'
                                                }}
                                                onClick={() => handleNodeClickRef.current && handleNodeClickRef.current(node.id)}
                                            >
                                                <Group justify="apart" wrap={false}>
                                                    <Text size="sm" lineClamp={1} fw={500} style={{ flex: 1 }}>{node.data.title}</Text>
                                                    {isProfessorOrAdmin() && (
                                                        <Text 
                                                            c="red" 
                                                            fw={700} 
                                                            size="md" 
                                                            style={{ cursor: 'pointer', marginLeft: '8px' }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeNode(node.id);
                                                            }}
                                                        >
                                                            -
                                                        </Text>
                                                    )}
                                                </Group>
                                            </Paper>
                                        ))}
                                    </Stack>
                                )}
                            </div>
                        </Paper>
                        
                        {/* Objectives section (3/4 height) */}
                        <Paper 
                            withBorder 
                            style={{ flex: '3', overflow: 'auto', display: 'flex', flexDirection: 'column' }}
                            p="md"
                        >
                            <Group gap="apart" mb="xs">
                                <Title order={4} style={{ color: '#fd7e14' }}>Objectives</Title>
                                {isProfessorOrAdmin() && (
                                    <ActionIcon 
                                        color="orange" 
                                        variant="light" 
                                        onClick={() => startAddingNode('objective')}
                                        disabled={addingOutcome || addingObjective}
                                    >
                                        <IconPlus size={16} />
                                    </ActionIcon>
                                )}
                            </Group>
                            
                            <div style={{ overflow: 'auto', flex: '1' }}>
                                {addingObjective && (
                                    <Paper 
                                        p="sm" 
                                        withBorder 
                                        style={{ 
                                            borderLeft: '3px solid #fd7e14',
                                            marginBottom: '8px'
                                        }}
                                    >
                                        <TextInput
                                            placeholder="Enter objective name..."
                                            value={newNodeTitle}
                                            onChange={(e) => setNewNodeTitle(e.target.value)}
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && newNodeTitle.trim()) confirmAddNode('objective');
                                                if (e.key === 'Escape') cancelAddNode();
                                            }}
                                        />
                                    </Paper>
                                )}
                                {objectiveNodes.length === 0 && !addingObjective ? (
                                    <Text size="sm" color="dimmed" ta="center" mt="md">
                                        No objectives yet. {isProfessorOrAdmin() ? '' : ''}
                                    </Text>
                                ) : (
                                    <Stack gap="xs">
                                        {objectiveNodes.map(node => (
                                            <Paper 
                                                key={node.id} 
                                                p="sm" 
                                                withBorder 
                                                style={{ 
                                                    borderLeft: node.id === selectedNode?.id ? 
                                                        '5px solid #fd7e14' : 
                                                        '3px solid #fd7e14',
                                                    cursor: 'pointer',
                                                    background: 'transparent'
                                                }}
                                                onClick={() => handleNodeClickRef.current && handleNodeClickRef.current(node.id)}
                                            >
                                                <Group position="apart" wrap={false}>
                                                    <Text size="sm" lineClamp={1} fw={500} style={{ flex: 1 }}>{node.data.title}</Text>
                                                    {isProfessorOrAdmin() && (
                                                        <Text 
                                                            c="red" 
                                                            fw={700} 
                                                            size="md" 
                                                            style={{ cursor: 'pointer', marginLeft: '8px' }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeNode(node.id);
                                                            }}
                                                        >
                                                            -
                                                        </Text>
                                                    )}
                                                </Group>
                                            </Paper>
                                        ))}
                                    </Stack>
                                )}
                            </div>
                        </Paper>
                    </div>
                </div>
            </Container>

            {/* Modal for editing nodes */}
            <Modal 
              opened={editOpened} 
              onClose={closeEdit}
              centered
              padding="md"
              title=""
              withCloseButton={true}
              styles={{
                header: { 
                  padding: '0px', 
                  marginBottom: 0,
                  minHeight: '20px'
                },

              }}
            >
              <Stack gap="md">
                <TextInput
                  label="Title"
                  placeholder="Enter a title"
                  value={nodeForm.title}
                  onChange={(e) => setNodeForm({...nodeForm, title: e.target.value})}
                />
                <TextInput
                  label="Description"
                  placeholder="Enter a description (optional)"
                  value={nodeForm.description}
                  onChange={(e) => setNodeForm({...nodeForm, description: e.target.value})}
                />
                <Button onClick={updateNode}>Update Card</Button>
              </Stack>
            </Modal>
        </ClassLayout>
    );
}