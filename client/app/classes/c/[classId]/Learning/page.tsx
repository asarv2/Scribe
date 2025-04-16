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
  Modal, TextInput, ActionIcon, Badge, Slider,
  Tooltip
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import ReactFlow, { 
    Background, Node, Edge, Connection,
    addEdge, useNodesState, useEdgesState, ReactFlowProvider, 
    Handle, Position, useReactFlow
} from 'react-flow-renderer';
import 'reactflow/dist/style.css';
import { IconPlus, IconEdit, IconRefresh } from '@tabler/icons-react';
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { 
  getOutcomes, getObjectives, createOutcome, updateOutcome, deleteOutcome,
  createObjective, updateObjective, deleteObjective, updateObjectiveConnection,
  Outcome, Objective, getLectures, Lecture
} from "@/utils/queries/get-connections";
import { analyzeConnections, batchCreateConnections, getTaskConnections, ConnectionSuggestion } from "@/utils/services/learning-connections";

// New interfaces for connection suggestions
interface ConnectionSuggestion {
  source_id: string;
  target_id: string;
  source_type: string;
  target_type: string;
  confidence: number;
  explanation: string;
}

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

const TaskNode = ({ data, id }) => (
  <Paper 
    p="md" 
    radius="md" 
    withBorder 
    style={{ 
      background: 'transparent', 
      width: 250, 
      border: '2px solid #40c057',
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
    <Stack gap="xs" align="center">
      <Badge color="green" size="sm" variant="transparent">{data.title}</Badge>
      {data.description && data.description !== 'No description' && (
        <Text size="sm" lineClamp={3} color="dimmed" ta="center">
          {data.description}
        </Text>
      )}
    </Stack>
    <Handle 
      type="source" 
      position={Position.Bottom} 
      style={{ background: '#40c057' }}
      id={`${id}-bottom-source`}
    />
    <Handle 
      type="target" 
      position={Position.Top} 
      style={{ background: '#40c057' }}
      id={`${id}-top-target`}
    />
  </Paper>
);

// Node type to component mapping
const nodeTypes = {
  outcome: OutcomeNode,
  objective: ObjectiveNode,
  task: TaskNode,
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

// Update the ViewportIndicator component to only show when no nodes are in frame
const ViewportIndicator = () => {
  const { getViewport, getNodes } = useReactFlow();
  const [angle, setAngle] = useState(0);
  const [showIndicator, setShowIndicator] = useState(false);
  
  // Check if any nodes are visible in the viewport
  useEffect(() => {
    const checkNodesInViewport = () => {
      const nodes = getNodes();
      if (nodes.length === 0) {
        // No nodes in diagram, no need for indicator
        setShowIndicator(false);
        return;
      }
      
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
      
      // Check if ANY node is visible in the viewport
      let anyNodeVisible = false;
      // Track all nodes for center of mass calculation
      let outsideNodes = [];
      
      for (const node of nodes) {
        const { position, width, height } = node;
        const nodeWidth = width ?? 250;
        const nodeHeight = height ?? 150;
        
        // Check if node is at least partially visible in viewport
        // A node is visible if any part of it intersects with the viewport
        const nodeRight = position.x + nodeWidth;
        const nodeBottom = position.y + nodeHeight;
        
        const isVisible = !(
          nodeRight < leftBoundary || 
          position.x > rightBoundary || 
          nodeBottom < topBoundary || 
          position.y > bottomBoundary
        );
        
        if (isVisible) {
          anyNodeVisible = true;
        } else {
          // If not visible, add to outside nodes for direction calculation
          outsideNodes.push({ 
            x: position.x + nodeWidth / 2, 
            y: position.y + nodeHeight / 2 
          });
        }
      }
      
      // Only show indicator if there are nodes in the dataset but none are visible
      if (!anyNodeVisible && outsideNodes.length > 0) {
        setShowIndicator(true);
        
        // Calculate the center of mass of outside nodes
        const comX = outsideNodes.reduce((sum, node) => sum + node.x, 0) / outsideNodes.length;
        const comY = outsideNodes.reduce((sum, node) => sum + node.y, 0) / outsideNodes.length;
        
        // Calculate angle from viewport center to center of mass
        const deltaX = comX - centerX;
        const deltaY = comY - centerY;
        
        // Calculate angle in degrees
        const angleRadians = Math.atan2(deltaY, deltaX);
        const angleDegrees = (angleRadians * 180 / Math.PI);
        
        setAngle(angleDegrees);
      } else {
        setShowIndicator(false);
      }
    };
    
    // Run check initially and on viewport changes
    checkNodesInViewport();
    
    // Add event listeners to detect viewport changes
    const viewportEl = document.querySelector('.react-flow__viewport');
    if (viewportEl) {
      // Use MutationObserver to detect style changes (pan/zoom)
      const observer = new MutationObserver(checkNodesInViewport);
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

// Add this new function for distributing nodes to avoid overlaps
const distributeNodes = (originalNodes) => {
  // Make a copy to avoid mutating the original
  const nodes = [...originalNodes];
  
  // Define node dimensions and distance constraints
  const nodeWidth = 250;  // Width of node
  const nodeHeight = 150; // Approximate height of node
  const minDistance = 5;  // Minimum distance in dots (5 dots minimum spacing)
  const maxDistance = 2;  // Maximum distance for unconnected nodes (2 dots)
  
  // Get a map of connections to identify connected nodes
  const nodeConnections = new Map();
  nodes.forEach(node => {
    nodeConnections.set(node.id, []);
  });
  
  // Consider connection information (if available)
  // In a real implementation, you'd use the connections data
  
  // Force-directed algorithm - only applied on initial load
  const iterations = 30;  // Fewer iterations for faster positioning
  
  for (let i = 0; i < iterations; i++) {
    let totalMovement = 0;
    
    // For each pair of nodes
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const nodeA = nodes[a];
        const nodeB = nodes[b];
        
        // Check if these nodes are connected (for real implementation)
        const areConnected = false; // placeholder
        
        // Calculate centers of nodes
        const centerA = {
          x: nodeA.position.x + nodeWidth / 2,
          y: nodeA.position.y + nodeHeight / 2
        };
        
        const centerB = {
          x: nodeB.position.x + nodeWidth / 2,
          y: nodeB.position.y + nodeHeight / 2
        };
        
        // Calculate distance between nodes
        const dx = centerB.x - centerA.x;
        const dy = centerB.y - centerA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate normalized direction vector
        const nx = dx / (distance || 1);  // Avoid division by zero
        const ny = dy / (distance || 1);
        
        // Minimum required distance (in pixels) to prevent overlaps
        const minRequiredDistance = nodeWidth * minDistance / 100;
        
        // If nodes are overlapping or too close (below min distance)
        if (distance < minRequiredDistance) {
          // Apply more force for overlapping nodes
          const force = (minRequiredDistance - distance) * 0.5;
          
          // Apply forces to both nodes in opposite directions
          nodeA.position.x -= nx * force / 2;
          nodeA.position.y -= ny * force / 2;
          nodeB.position.x += nx * force / 2;
          nodeB.position.y += ny * force / 2;
          
          totalMovement += force;
        }
      }
    }
    
    // Break early if nodes have stabilized
    if (totalMovement < 0.5) break;
  }
  
  // Return the repositioned nodes
  return nodes;
};

export default function LearningPage({ params }: { params: Promise<{ classId: string }> }) {
    const { classId } = use(params);
    const supabase = useSupabaseBrowser(); // Get Supabase client
    const [opened, { open, close }] = useDisclosure(false);
    const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
    const [nodeForm, setNodeForm] = useState({
      type: 'outcome',
      title: '',
      description: '',
    });
    const [editingNode, setEditingNode] = useState<Node | null>(null);
    
    // Local data storage with Supabase sync
    const [outcomes, setOutcomes] = useState<any[]>([]);
    const [objectives, setObjectives] = useState<any[]>([]);
    const [connections, setConnections] = useState<any[]>([]);
    const [lectures, setLectures] = useState<Lecture[]>([]);
    const [isAdmin, setIsAdmin] = useState(true); // Set to true for simplicity
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [connectingMode, setConnectingMode] = useState(false);
    const [connectionSource, setConnectionSource] = useState(null);
    
    // Add state variables to track adding state
    const [addingOutcome, setAddingOutcome] = useState(false);
    const [addingObjective, setAddingObjective] = useState(false);
    const [addingTask, setAddingTask] = useState(false);
    const [newNodeTitle, setNewNodeTitle] = useState('');

    // Add state for AI connections
    const [analyzing, setAnalyzing] = useState(false);
    const [suggestedConnections, setSuggestedConnections] = useState<ConnectionSuggestion[]>([]);
    const [applyingConnections, setApplyingConnections] = useState(false);

    // Define isProfessorOrAdmin function - always returns true for simplicity
    const isProfessorOrAdmin = useCallback(() => {
        return true;
    }, []);

    // Use refs to keep handler functions stable
    const handleNodeClickRef = useRef<((nodeId: string) => void) | null>(null);
    const handleEditNodeRef = useRef<((nodeId: string) => void) | null>(null);
    const initialLayoutAppliedRef = useRef(false);

    // Extract loadData function from useEffect to make it reusable
    const loadData = async () => {
      setLoading(true);
      try {
        console.log(`Loading data for class ${classId}...`);
        // Fetch outcomes and objectives from Supabase
        const fetchedOutcomes = await getOutcomes(supabase, classId);
        console.log(`Fetched ${fetchedOutcomes.length} outcomes`);
        
        // Use the utility function instead of direct Supabase query
        const fetchedObjectives = await getObjectives(supabase, classId);
        console.log(`Fetched ${fetchedObjectives.length} objectives`);
        
        // Fetch lectures for tasks
        const fetchedLectures = await getLectures(supabase, classId);
        console.log(`Fetched ${fetchedLectures.length} lectures`);
        
        setOutcomes(fetchedOutcomes);
        setObjectives(fetchedObjectives);
        setLectures(fetchedLectures);
        
        // Generate connections based on outcome_id relationships, now including handles if available
        const derivedConnections = fetchedObjectives
          .filter(obj => obj.outcome_id)
          .map(obj => ({
            id: `edge-${obj.id}-${obj.outcome_id}`,
            source_id: obj.outcome_id,
            source_type: 'outcome',
            target_id: obj.id,
            target_type: 'objective',
            // Include handle information if available - with null fallbacks
            source_handle: obj.connection_source_handle || null,
            target_handle: obj.connection_target_handle || null,
            class_id: classId
          }));
        
        console.log(`Created ${derivedConnections.length} connections`);
        setConnections(derivedConnections);
        
        // Log connection details for debugging
        if (derivedConnections.length > 0) {
          console.log("Connection examples:", 
            derivedConnections.slice(0, 2).map(conn => ({
              id: conn.id,
              source: conn.source_id,
              target: conn.target_id,
              sourceHandle: conn.source_handle,
              targetHandle: conn.target_handle
            }))
          );
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    // Manual refresh function
    const handleRefresh = () => {
      setRefreshing(true);
      loadData();
    };

    // Modify the useEffect to use this function but WITHOUT the interval
    useEffect(() => {
        loadData();
    }, [classId, supabase]);

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
              if (sourceNode.type === 'outcome' && targetNode.type === 'objective') {
                // Create default connection with bottom/top handles instead of right/left
                const sourceHandle = `${sourceNode.id}-bottom-source`;
                const targetHandle = `${targetNode.id}-top-target`;
                
                // Update objective to connect to outcome in Supabase with handle info
                updateObjectiveConnection(
                  supabase, 
                  targetNode.id, 
                  sourceNode.id,
                  {
                    source_handle: sourceHandle,
                    target_handle: targetHandle
                  }
                );
                
                // Add to local connections state
                const newConnectionId = `edge-${targetNode.id}-${sourceNode.id}`;
                setConnections(prev => [
                  ...prev,
                  {
                    id: newConnectionId,
                    source_id: sourceNode.id,
                    source_type: sourceNode.type,
                    target_id: targetNode.id,
                    target_type: targetNode.type,
                    source_handle: sourceHandle,
                    target_handle: targetHandle,
                    class_id: classId
                  }
                ]);
                
                // Create edge in the graph
                setEdges(eds => [
                  ...eds,
                  {
                    id: newConnectionId,
                    source: sourceNode.id,
                    target: targetNode.id,
                    sourceHandle: sourceHandle,
                    targetHandle: targetHandle,
                    animated: true,
                    style: { stroke: '#999' }
                  }
                ]);
              }
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
            
            setConnectingMode(false);
            setConnectionSource(null);
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
    }, [nodes, connectingMode, connectionSource, setNodes, setConnections, setEdges, classId, supabase]);

    // Function for handling node position changes
    const onNodesChangeWithSave = useCallback((changes) => {
        // Apply the changes locally ONLY - don't trigger any redistribution
        onNodesChange(changes);
        
        // Then for each position change, update our local state and Supabase
        for (const change of changes) {
            if (change.type === 'position' && change.position) {
                // Find the node
                const node = nodes.find(n => n.id === change.id);
                if (!node) continue;
                
                // Save debounced to prevent excessive Supabase calls
                const updatePosition = async () => {
                    // Update position in Supabase
                    if (node.type === 'outcome') {
                        await updateOutcome(supabase, node.id, {
                            position_x: change.position.x,
                            position_y: change.position.y
                        });
                        
                        // Update position in local state
                        setOutcomes(prev => prev.map(outcome => 
                            outcome.id === node.id 
                                ? {...outcome, position_x: change.position.x, position_y: change.position.y} 
                                : outcome
                        ));
                    } else if (node.type === 'objective') {
                        await updateObjective(supabase, node.id, {
                            position_x: change.position.x,
                            position_y: change.position.y
                        });
                        
                        // Update position in local state
                        setObjectives(prev => prev.map(objective => 
                            objective.id === node.id 
                                ? {...objective, position_x: change.position.x, position_y: change.position.y} 
                                : objective
                        ));
                    }
                };
                
                // Debounce position updates to reduce DB calls
                clearTimeout(node.data?.positionUpdateTimer);
                
                const timer = setTimeout(updatePosition, 500);
                
                // Store timer in node data for cleanup
                setNodes(nodes => nodes.map(n => 
                    n.id === node.id 
                        ? {...n, data: {...n.data, positionUpdateTimer: timer}} 
                        : n
                ));
            }
        }
    }, [nodes, onNodesChange, setNodes, setOutcomes, setObjectives, supabase]);

    // Update onConnect to work with Supabase
    const onConnect = useCallback(async (params) => {
        try {
            // Find source and target nodes to determine their types
            const sourceNode = nodes.find(n => n.id === params.source);
            const targetNode = nodes.find(n => n.id === params.target);
            
            if (!sourceNode || !targetNode) return;
            
            const newConnectionId = `edge-${targetNode.id}-${sourceNode.id}`;
            
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
            
            // Only update in Supabase when connecting an outcome to an objective
            if (sourceNode.type === 'outcome' && targetNode.type === 'objective') {
                // Update objective to link to the outcome in Supabase
                // Now pass the handle information
                await updateObjectiveConnection(
                  supabase, 
                  targetNode.id, 
                  sourceNode.id, 
                  {
                    source_handle: params.sourceHandle,
                    target_handle: params.targetHandle
                  }
                );
                
                // Add to local connections state with handle information
                setConnections(prev => [...prev, {
                    id: newConnectionId,
                    source_id: sourceNode.id,
                    source_type: sourceNode.type,
                    target_id: targetNode.id,
                    target_type: targetNode.type,
                    source_handle: params.sourceHandle,
                    target_handle: params.targetHandle,
                    class_id: classId
                }]);
            }
            
            setConnectingMode(false);
            setConnectionSource(null);
        } catch (error) {
            console.error("Error in onConnect:", error);
        }
    }, [nodes, setEdges, setConnections, classId, setConnectingMode, setConnectionSource, supabase]);

    // Modify the useEffect that converts data to nodes to apply the distribution algorithm
    useEffect(() => {
        if (outcomes.length > 0 || objectives.length > 0 || lectures.length > 0 || connections.length > 0) {
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
            
            // Convert lectures to task nodes
            const taskNodes = lectures.map((lecture, index) => ({
                id: lecture.id,
                type: 'task',
                position: { 
                    x: lecture.position_x || (Math.random() * 300) + 300, 
                    y: lecture.position_y || (Math.random() * 300) + 300 
                },
                data: { 
                    title: lecture.name, 
                    description: lecture.description || '',
                    onNodeClick: handleNodeClickRef.current
                }
            }));
            
            // Combine all node types
            const allNodes = [...outcomeNodes, ...objectiveNodes, ...taskNodes];
            
            // Critical change: Only apply distribution on FIRST load, when positions are missing or zero
            const needsPositioning = !initialLayoutAppliedRef.current && 
                allNodes.some(node => 
                    (node.position.x === 0 && node.position.y === 0) || 
                    !node.position.x || 
                    !node.position.y
                );
            
            let finalNodes = allNodes;
            
            // ONLY apply distribution algorithm on first load
            if (needsPositioning && allNodes.length > 0) {
                console.log("Applying initial node distribution");
                finalNodes = distributeNodes(allNodes);
                initialLayoutAppliedRef.current = true; // Set this to true to prevent future redistributions
                
                // Save new positions to database on initial load
                const savePositions = async () => {
                    for (const node of finalNodes) {
                        if (node.type === 'outcome') {
                            await updateOutcome(supabase, node.id, {
                                position_x: node.position.x,
                                position_y: node.position.y
                            });
                        } else if (node.type === 'objective') {
                            await updateObjective(supabase, node.id, {
                                position_x: node.position.x,
                                position_y: node.position.y
                            });
                        }
                    }
                };
                savePositions();
            }
            
            // Set nodes with distributed positions
            setNodes(finalNodes);
            
            // Convert connections to edges - make sure we're properly creating edges with valid handles
            const connectionEdges = connections.map(connection => {
                // Define default source and target handles based on node types
                const defaultSourceHandle = `${connection.source_id}-bottom-source`;
                const defaultTargetHandle = `${connection.target_id}-top-target`;
                
                // Create the edge with appropriate handles
                const edge = {
                    id: connection.id,
                    source: connection.source_id,
                    target: connection.target_id,
                    animated: true,
                    style: { stroke: '#999' },
                    // Use connection handles if available, otherwise use defaults
                    sourceHandle: connection.source_handle || defaultSourceHandle, 
                    targetHandle: connection.target_handle || defaultTargetHandle
                };
                
                return edge;
            });
            
            console.log(`Created ${connectionEdges.length} edges from connections`);
            if (connectionEdges.length > 0) {
                console.log("Example edge:", connectionEdges[0]);
            }
            
            setEdges(connectionEdges);
        }
    }, [outcomes, objectives, lectures, connections, isProfessorOrAdmin, setNodes, setEdges, supabase]);

    // Function to remove a node
    const removeNode = async (nodeId) => {
      try {
        // Find the node to determine its type
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        console.log(`Removing ${node.type} with ID ${nodeId}`);
        
        // Delete from Supabase based on node type
        let success = false;
        
        if (node.type === 'outcome') {
          success = await deleteOutcome(supabase, nodeId);
          if (success) {
            setOutcomes(prev => prev.filter(outcome => outcome.id !== nodeId));
          }
        } else if (node.type === 'objective') {
          success = await deleteObjective(supabase, nodeId);
          if (success) {
            setObjectives(prev => prev.filter(objective => objective.id !== nodeId));
          }
        }
        
        if (!success) {
          console.error(`Failed to delete ${node.type} ${nodeId}`);
          return;
        }
        
        // Remove from connections and UI regardless of success
        setConnections(prev => prev.filter(conn => 
          conn.source_id !== nodeId && conn.target_id !== nodeId
        ));
        setNodes(nds => nds.filter(n => n.id !== nodeId));
        setEdges(eds => eds.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
        
        console.log(`Successfully deleted ${node.type} ${nodeId}`);
      } catch (error) {
        console.error(`Unexpected error when removing node ${nodeId}:`, error);
        alert(`Unexpected error during deletion. The UI will refresh to ensure consistency.`);
        loadData();
      }
    };

    const updateNode = async () => {
      if (!nodeForm.title || !editingNode) return;
      
      try {
        const updates = {
          title: nodeForm.title,
          description: nodeForm.description || ''
        };
        
        // Update in Supabase
        if (editingNode.type === 'outcome') {
          await updateOutcome(supabase, editingNode.id, updates);
          
          // Update in local state
          setOutcomes(prev => prev.map(outcome => 
            outcome.id === editingNode.id
                ? {...outcome, ...updates}
                : outcome
          ));
        } else {
          await updateObjective(supabase, editingNode.id, updates);
          
          // Update in local state
          setObjectives(prev => prev.map(objective => 
            objective.id === editingNode.id
                ? {...objective, ...updates}
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

    const startAddingNode = (type) => {
      if (type === 'outcome') {
        setAddingOutcome(true);
        setAddingObjective(false);
        setAddingTask(false);
      } else if (type === 'objective') {
        setAddingOutcome(false);
        setAddingObjective(true);
        setAddingTask(false);
      } else {
        setAddingOutcome(false);
        setAddingObjective(false);
        setAddingTask(true);
      }
      setNewNodeTitle('');
    };

    const confirmAddNode = async (type) => {
      if (!newNodeTitle.trim()) return;

      try {
        // Calculate a better initial position by looking at existing nodes
        const calculateNewPosition = () => {
            if (nodes.length === 0) {
                return { x: 100, y: 100 };
            }
            
            // Find the rightmost and bottommost positions of existing nodes
            let maxX = -Infinity, maxY = -Infinity;
            nodes.forEach(node => {
                maxX = Math.max(maxX, node.position.x);
                maxY = Math.max(maxY, node.position.y);
            });
            
            // Create a new position that's offset from existing nodes
            // Try to form a grid-like pattern
            if (maxX > 800) {
                // Start a new row
                return { 
                    x: 100, 
                    y: maxY + 300
                };
            } else {
                // Continue the current row
                return { 
                    x: maxX + 300, 
                    y: maxY
                };
            }
        };
        
        const position = calculateNewPosition();

        const newNodeData = {
          title: newNodeTitle.trim(),
          description: '',
          position_x: position.x,
          position_y: position.y,
          class: classId
        };

        let newNode;

        if (type === 'outcome') {
          const createdOutcome = await createOutcome(supabase, newNodeData);
          if (!createdOutcome) throw new Error('Failed to create outcome');

          setOutcomes(prev => [...prev, createdOutcome]);

          newNode = {
            id: createdOutcome.id,
            type: 'outcome',
            position,
            data: { 
              title: createdOutcome.title, 
              description: createdOutcome.description || '', 
              isEditable: isProfessorOrAdmin(),
              onEdit: handleEditNodeRef.current,
              onNodeClick: handleNodeClickRef.current
            }
          };
        } else if (type === 'objective') {
          const createdObjective = await createObjective(supabase, {
            ...newNodeData,
            outcome_id: null
          });
          if (!createdObjective) throw new Error('Failed to create objective');

          setObjectives(prev => [...prev, createdObjective]);

          newNode = {
            id: createdObjective.id,
            type: 'objective',
            position,
            data: { 
              title: createdObjective.title, 
              description: createdObjective.description || '', 
              isEditable: isProfessorOrAdmin(),
              onEdit: handleEditNodeRef.current,
              onNodeClick: handleNodeClickRef.current
            }
          };
        } else {
          // Placeholder for task creation logic
          console.log("Task creation is not implemented yet.");
        }

        setNodes((nds) => [...nds, newNode]);
        setAddingOutcome(false);
        setAddingObjective(false);
        setAddingTask(false);
        setNewNodeTitle('');
      } catch (error) {
        console.error("Error creating node:", error);
      }
    };

    const cancelAddNode = () => {
      setAddingOutcome(false);
      setAddingObjective(false);
      setAddingTask(false);
      setNewNodeTitle('');
    };

    const handleAnalyzeConnections = async () => {
      setAnalyzing(true);
      try {
        console.log("Starting connection analysis for class:", classId);
        console.log("Outcomes:", outcomes.length, "Objectives:", objectives.length, "Lectures:", lectures.length);
        
        // Call the API to analyze connections
        const result = await analyzeConnections(
          classId,
          outcomes,
          objectives,
          lectures
        );
        
        if (result.success) {
          console.log("Analysis successful!", {
            objective_connections: result.objective_connections.length,
            task_connections: result.task_connections.length
          });
          
          // Log each connection for debugging
          result.objective_connections.forEach((conn, i) => {
            console.log(`Objective Connection ${i+1}:`, {
              source: conn.source_id,
              target: conn.target_id,
              confidence: conn.confidence
            });
          });
          
          // Store the suggested connections
          setSuggestedConnections([
            ...result.objective_connections,
            ...result.task_connections
          ]);
          
          // Show a preview of the connections as temporary edges
          const tempEdges = result.objective_connections.map(conn => {
            // Make sure the outcome is the source and objective is the target
            const edge = {
              id: `temp-edge-${conn.source_id}-${conn.target_id}`,
              source: conn.source_id,
              target: conn.target_id,
              animated: true,
              style: { stroke: '#4dabf7', strokeWidth: 2, strokeDasharray: '5,5' }, // Make more visible
              label: `${Math.round(conn.confidence * 100)}%`, // Add confidence as label
              // Use specific handle IDs that match our node components
              sourceHandle: `${conn.source_id}-bottom-source`,
              targetHandle: `${conn.target_id}-top-target`
            };
            console.log("Created temp edge:", edge);
            return edge;
          });
          
          // Add task connections to the preview
          const taskTempEdges = result.task_connections.map(conn => {
            const edge = {
              id: `temp-edge-${conn.source_id}-${conn.target_id}`,
              source: conn.source_id,
              target: conn.target_id,
              animated: true,
              style: { stroke: '#40c057', strokeWidth: 2, strokeDasharray: '5,5' }, // Green for task connections
              label: `${Math.round(conn.confidence * 100)}%`,
              sourceHandle: `${conn.source_id}-bottom-source`,
              targetHandle: `${conn.target_id}-top-target`
            };
            console.log("Created temp task edge:", edge);
            return edge;
          });
          
          console.log(`Adding ${tempEdges.length + taskTempEdges.length} temporary edges to graph`);
          
          // Make sure to preserve existing edges too
          setEdges(currentEdges => {
            console.log("Current edges:", currentEdges.length);
            return [...currentEdges, ...tempEdges, ...taskTempEdges];
          });
        } else {
          console.error("Analysis failed:", result.error);
        }
      } catch (error) {
        console.error("Error analyzing connections:", error);
      } finally {
        setAnalyzing(false);
      }
    };

    const handleApplyConnections = async () => {
      setApplyingConnections(true);
      try {
        console.log("Applying connections, count:", suggestedConnections.length);
        
        // Prepare connection data with handle information
        const connectionsWithHandles = suggestedConnections.map(conn => ({
          ...conn,
          // Add handle information for the connection
          source_handle: `${conn.source_id}-bottom-source`,
          target_handle: `${conn.target_id}-top-target`
        }));
        
        // Call the API to apply connections
        const result = await batchCreateConnections(
          classId,
          connectionsWithHandles
        );
        
        if (result.success) {
          console.log("Connections applied successfully:", result.updated_count);
          
          // Remove temporary edges first
          setEdges(currentEdges => {
            const remainingEdges = currentEdges.filter(edge => !edge.id.startsWith('temp-edge-'));
            console.log(`Removed ${currentEdges.length - remainingEdges.length} temporary edges`);
            return remainingEdges;
          });
          
          // Clear suggested connections
          setSuggestedConnections([]);
          
          // Reload data to get the updated connections
          console.log("Reloading data to get updated connections");
          await loadData();
        } else {
          console.error("Failed to apply connections:", result.error);
          // Continue anyway and still try to reload data
          setEdges(edges.filter(edge => !edge.id.startsWith('temp-edge-')));
          setSuggestedConnections([]);
          await loadData();
        }
      } catch (error) {
        console.error("Error applying connections:", error);
        // Still try to recover by reloading data
        setEdges(edges.filter(edge => !edge.id.startsWith('temp-edge-')));
        setSuggestedConnections([]);
        await loadData();
      } finally {
        setApplyingConnections(false);
      }
    };

    const handleCancelConnections = () => {
      // Remove temporary edges
      setEdges(edges.filter(edge => !edge.id.startsWith('temp-edge-')));
      
      // Clear suggested connections
      setSuggestedConnections([]);
    };

    const outcomeNodes = nodes.filter(node => node.type === 'outcome');
    const objectiveNodes = nodes.filter(node => node.type === 'objective');
    const taskNodes = nodes.filter(node => node.type === 'task');

    return (
        <ClassLayout classId={classId}>
            <Container fluid h="calc(100vh - 120px)">
                <Group justify="space-between" mb="md">
                    <Title order={2}>Learning Outcomes & Objectives</Title>
                    <Group>
                        {suggestedConnections.length > 0 ? (
                          <>
                            <Button 
                              color="green" 
                              onClick={handleApplyConnections}
                              loading={applyingConnections}
                              leftSection={<IconEdit size={20} />}
                            >
                              Apply Connections
                            </Button>
                            <Button 
                              color="red" 
                              onClick={handleCancelConnections}
                              variant="outline"
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button 
                            color="blue" 
                            onClick={handleAnalyzeConnections}
                            loading={analyzing}
                            leftSection={<IconRefresh size={20} />}
                          >
                            Auto-Connect Nodes
                          </Button>
                        )}
                        <Tooltip label="Refresh data">
                            <ActionIcon 
                                variant="light" 
                                color="blue" 
                                onClick={handleRefresh}
                                loading={refreshing}
                                size="lg"
                            >
                                <IconRefresh size={20} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                </Group>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
                        <Text>Loading learning data...</Text>
                    </div>
                ) : (
                    <div style={{ display: 'flex', height: 'calc(100vh - 180px)' }}>
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
                        <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
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
                                            disabled={addingOutcome || addingObjective || addingTask}
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
                            <Paper 
                                withBorder 
                                style={{ flex: '1', marginBottom: '8px', overflow: 'auto', display: 'flex', flexDirection: 'column' }}
                                p="md"
                            >
                                <Group gap="apart" mb="xs">
                                    <Title order={4} style={{ color: '#fd7e14' }}>Objectives</Title>
                                    {isProfessorOrAdmin() && (
                                        <ActionIcon 
                                            color="orange" 
                                            variant="light" 
                                            onClick={() => startAddingNode('objective')}
                                            disabled={addingOutcome || addingObjective || addingTask}
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
                            <Paper 
                                withBorder 
                                style={{ flex: '1', overflow: 'auto', display: 'flex', flexDirection: 'column' }}
                                p="md"
                            >
                                <Group gap="apart" mb="xs">
                                    <Title order={4} style={{ color: '#40c057' }}>Tasks</Title>
                                    {isProfessorOrAdmin() && (
                                        <ActionIcon 
                                            color="green" 
                                            variant="light" 
                                            onClick={() => {
                                                setAddingTask(true);
                                                setAddingOutcome(false);
                                                setAddingObjective(false);
                                                setNewNodeTitle('');
                                            }}
                                            disabled={addingOutcome || addingObjective || addingTask}
                                        >
                                            <IconPlus size={16} />
                                        </ActionIcon>
                                    )}
                                </Group>
                                <div style={{ overflow: 'auto', flex: '1' }}>
                                    {addingTask && (
                                        <Paper 
                                            p="sm" 
                                            withBorder 
                                            style={{ 
                                                borderLeft: '3px solid #40c057',
                                                marginBottom: '8px'
                                            }}
                                        >
                                            <TextInput
                                                placeholder="Enter task name..."
                                                value={newNodeTitle}
                                                onChange={(e) => setNewNodeTitle(e.target.value)}
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && newNodeTitle.trim()) {
                                                        setAddingTask(false);
                                                        setNewNodeTitle('');
                                                    }
                                                    if (e.key === 'Escape') {
                                                        setAddingTask(false);
                                                        setNewNodeTitle('');
                                                    }
                                                }}
                                            />
                                        </Paper>
                                    )}
                                    {taskNodes.length === 0 && !addingTask ? (
                                        <Text size="sm" color="dimmed" ta="center" mt="md">
                                            No tasks yet.
                                        </Text>
                                    ) : (
                                        <Stack gap="xs">
                                            {taskNodes.map(node => (
                                                <Paper 
                                                    key={node.id}
                                                    p="sm" 
                                                    withBorder 
                                                    style={{ 
                                                        borderLeft: node.id === selectedNode?.id ? 
                                                            '5px solid #40c057' : 
                                                            '3px solid #40c057',
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
                                                                    // For now, we'll just remove from display
                                                                    // Can be enhanced to truly delete tasks later
                                                                    setNodes(nds => nds.filter(n => n.id !== node.id));
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
                )}
            </Container>
            <Modal
              opened={editOpened}
              onClose={closeEdit}
              centered
              padding="md"
              title="Edit Node"
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