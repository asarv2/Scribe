/**
 * Map.tsx
 * Will be used to show the mindmap of each of the classes
 * @AshokSaravanan222
 * 11-12-2024
 */


import ELK, { ElkNode, LayoutOptions } from 'elkjs/lib/elk.bundled.js'
import { PropsWithChildren, useCallback, useEffect, useState } from 'react'
import {
	ReactFlow,
	Background,
	BackgroundVariant,
	Controls,
	Edge,
	Node,
	Position,
	useEdgesState,
	useNodesState,
	useReactFlow,
	ControlButton,
	NodeChange,
	NodeReplaceChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { NodeComponent } from '@/components/NodeComponent'
import { FlatMapNode, MapNode } from '@/utils/map/map-tree'
import { Modal, Tooltip, Button, Stack, Text } from '@mantine/core';
import { IconArrowBackUp, IconArrowDown, IconCircle, IconDownload, IconPlus, IconRefresh, IconRosette, IconRotate, IconRotate360 } from '@tabler/icons-react';
import { User } from '@supabase/supabase-js';
import { isProfessor } from '@/utils/lecture/isProfessor';
import { useDisclosure } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { updateTopicPosition } from '@/utils/services/topics';
import { DownloadIcon, MagicWandIcon, ReloadIcon, TargetIcon } from '@radix-ui/react-icons'
import jsPDF from 'jspdf';
import { marked } from 'marked';
import { notifications } from '@mantine/notifications';

const elk = new ELK()

const useLayoutedElements = (rootNode: MapNode, computeGraph: boolean, setupMap: boolean, setSetupMap: React.Dispatch<React.SetStateAction<boolean>>, onNodePositionChange: (nodes: { id: string, map_id: string, x: number | null, y: number | null }[]) => void) => {
	const { getNodes, setNodes, getEdges, setCenter, zoomTo } =
		useReactFlow()
	const getLayoutedElements = useCallback(
		async (options: LayoutOptions) => {
			let rootNodePosition = { x: rootNode.xPosition ?? 0, y: rootNode.yPosition ?? 0 }

			if (computeGraph) {
				const layoutOptions = { ...options }
				const graph: ElkNode = {
					id: 'root',
					// @ts-ignore
					layoutOptions,
					// @ts-ignore
					children: getNodes(),
					// @ts-ignore
					edges: getEdges(),
				}
				const { children } = await elk.layout(graph)
				// By mutating the children in-place we saves ourselves from creating a
				// needless copy of the nodes array.
				// @ts-ignore
				children.forEach(node => {
					if ((node as any).parentNodeId === 'undefined') {
						console.log("rootNodePosition", rootNodePosition)
						rootNodePosition = { x: node.x!, y: node.y! }
					}
					// @ts-ignore
					node.position = { x: node.x, y: node.y }
				})
				// @ts-ignore
				setNodes(children)

				if (children) {
					const flatNodes = flattenMapNode(rootNode)
					const positionUpdates = children
						.map(node => {
							const supabaseId = flatNodes.find(n => n.id === node.id)?.supabaseId
							if (!supabaseId) return null
							return {
								id: supabaseId,
								map_id: node.id,
								x: node.x ?? null,
								y: node.y ?? null
							}
						})
						.filter((update): update is NonNullable<typeof update> => update !== null)

					if (positionUpdates.length > 0) {
						onNodePositionChange?.(positionUpdates)
					}
				}
			}
			if (!setupMap) {
				setTimeout(() => {
					setCenter(rootNodePosition.x, rootNodePosition.y)
					zoomTo(1)
				})
				setSetupMap(true)
			}
		},
		[setNodes, setCenter, zoomTo],
	)
	return { getLayoutedElements }
}

const COLORS = [
	'#ff6565',
	'#FF7F44',
	'#ffe344',
	'#00bb5a',
	'#4444FF',
	'#4B4482',
]

const NODE_TYPES = {
	keyword: NodeComponent,
}

export const flattenMapNode = (node: MapNode): FlatMapNode[] => {
	const { children, ...nodeWithoutChildren } = node
	if (!children) return [nodeWithoutChildren]
	return [
		nodeWithoutChildren,
		...children
			.map((child, idx) => ({
				parentId: node.id,
				color: node.color ?? COLORS[idx % COLORS.length],
				...child,
			}))
			.flatMap(child => flattenMapNode(child)),
	]
}

const createMap = (mapNode: MapNode): Node[] =>
	flattenMapNode(mapNode).map(node => ({
		type: 'keyword',
		id: node.id,
		parentNodeId: node.parentId,
		data: {
			label: node.keyword,
			color: node.color,
			description: node.description,
		},
		position: { x: node.xPosition ?? 0, y: node.yPosition ?? 0 },
		sourcePosition: Position.Top,
		targetPosition: Position.Bottom,
	}))

const createEdge = (mapNode: MapNode): Edge[] => {
	const sample = flattenMapNode(mapNode)
	return sample
		.filter(node => node.parentId !== undefined)
		.map(node => ({
			id: `${node.id}-edge`,
			source: node.id,
			target: node.parentId!,
		}))
}

export type MapProps = {
	classId: string
	user: User | undefined
	rootNode: MapNode
	onNodeClick: (id: string, nodeLabel: string, description: string) => void
	onNodePositionChange: (nodes: { id: string, map_id: string, x: number | null, y: number | null }[]) => void
}

// Add this helper function to check if layout is needed
const needsLayout = (nodes: FlatMapNode[]): boolean => {
	return nodes.some(node =>
		node.xPosition === undefined ||
		node.yPosition === undefined
	);
}

export const Map: React.FC<PropsWithChildren<MapProps>> = ({
	classId,
	user,
	rootNode,
	onNodeClick,
	onNodePositionChange,
	children,
}) => {
	const queryClient = useQueryClient()
	const computeGraph = needsLayout(flattenMapNode(rootNode))
	const { viewportInitialized } = useReactFlow()
	const [nodes, setNodes, onNodesChange] = useNodesState(createMap(rootNode))
	const [edges, , onEdgesChange] = useEdgesState(createEdge(rootNode))
	const [setupMap, setSetupMap] = useState(false)
	const { getLayoutedElements } = useLayoutedElements(rootNode, computeGraph, setupMap, setSetupMap, onNodePositionChange)

	const [downloadOpened, { open: openDownload, close: closeDownload }] = useDisclosure(false);
	const [resetOpened, { open: openReset, close: closeReset }] = useDisclosure(false);

	const [loading, setLoading] = useState(false);

	const handleCenter = () => {
		getLayoutedElements({
			'elk.algorithm': 'org.eclipse.elk.stress',
			// @ts-ignore
			'org.eclipse.elk.stress.desiredEdgeLength': 300,
		})
	}

	const handleResetCoordinates = async () => {
		try {
			setLoading(true);
			setSetupMap(false);

			// Create NodeChange objects to reset positions
			const resetChanges = nodes.map((node: any) => ({
				id: node.id,
				type: 'position', // Specify the type of change
				position: { x: node.parentNodeId ? null : 0, y: node.parentNodeId ? null : 0 }, // set the root node to 0,0 and all other nodes to null,null
				dragging: false, // Ensure dragging is set to false
			}));

			// Apply the changes
			await handleNodesChange(resetChanges);
		} catch (error) {
			console.error(error);
		} finally {
			setLoading(false);
			handleCenter(); // Re-center the map after reset
			closeReset();   // Close the modal
		}
	};



	// Modified effect to only run layout if needed
	useEffect(() => {
		if (viewportInitialized && !setupMap) {
			setTimeout(
				() =>
					getLayoutedElements({
						'elk.algorithm': 'org.eclipse.elk.stress',
						// @ts-ignore
						'org.eclipse.elk.stress.desiredEdgeLength': 300,
					}),
				100,
			)
		}
	}, [getLayoutedElements, viewportInitialized, nodes])

	// Handle position changes
	const handleNodesChange = useCallback(async (changes: any[]) => {
		onNodesChange(changes)

		// Only call update when dragging ends
		const flatNodes = flattenMapNode(rootNode)
		const positionUpdates = changes
			.filter(change => change.type === 'position' && change.dragging === false)
			.map(change => {
				const supabaseId = flatNodes.find(n => n.id === change.id)?.supabaseId
				if (!supabaseId) return null
				return {
					id: supabaseId,
					map_id: change.id,
					x: change.position.x,
					y: change.position.y
				}
			})
			.filter((update): update is NonNullable<typeof update> => update !== null)

		if (positionUpdates.length > 0) {
			onNodePositionChange?.(positionUpdates)
		}
	}, [onNodesChange, onNodePositionChange])

	const handleDownload = async () => {
        try {

            const doc = new jsPDF('p', 'pt', 'a4');
			const flatmap = flattenMapNode(rootNode)
            const content = flatmap.map(s => s.keyword + "<br><br>" + s.description).join("<br><br>");

            // Convert Markdown to HTML
            const htmlContent = `
            <style>
              body {
                width: 100%;
                max-width: 100%;
                margin: 0;
                padding: 0;
                font-family: Helvetica, Arial, sans-serif;
                font-size: 12pt;
                line-height: 1.2;
              }
            </style>
            ${marked(content)}
          `;

            // Adjust page width
            const pageWidth = doc.internal.pageSize.getWidth();

            doc.html(htmlContent, {
                x: 40,
                y: 40,
                width: pageWidth - 80, // Account for margins
                windowWidth: pageWidth,
                margin: [20, 20],
                callback: function (doc) {
                    doc.save(`summary.pdf`);
                },
            });

            notifications.show({
                title: 'Download',
                message: 'Download successful',
                color: 'blue',
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: 'Failed to download',
                message: error.message,
                color: 'red',
            });
        }
    }

	return (
		<>
			<ReactFlow
				snapGrid={[16, 16]}
				nodes={nodes}
				edges={edges}
				onNodesChange={handleNodesChange}
				onEdgesChange={onEdgesChange}
				fitView
				fitViewOptions={{ padding: 20 }}
				nodeTypes={NODE_TYPES}
				onNodeClick={(e, n) => {
					onNodeClick?.(n.id, n.data.label as string, n.data.description as string)
				}}
				nodesDraggable={isProfessor(user, classId)}
				nodesConnectable={false}
			>
				<Controls showInteractive={false} showZoom={true} showFitView={true} orientation='horizontal'>
					{/* <ControlButton onClick={handleCenter}>
						<TargetIcon />
					</ControlButton> */}
					{/* <ControlButton onClick={openDownload}>
						<DownloadIcon />
					</ControlButton> */}
					{isProfessor(user, classId) && <ControlButton onClick={openReset}>
						<ReloadIcon />
					</ControlButton>}
				</Controls>
				<Background variant={BackgroundVariant.Dots} gap={16} size={1} />
				{children}
			</ReactFlow>
			<Modal opened={resetOpened} onClose={closeReset} title="Reset Nodes" centered>
				<Stack>
					<Text>Are you sure you want to reset the node positions?</Text>
					<Button onClick={handleResetCoordinates} loading={loading} color="red">Reset</Button>
				</Stack>
			</Modal>
			<Modal opened={downloadOpened} onClose={closeDownload} title="Download Map" centered>
				<Stack>
					{/* <Button
						component="a"
						href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/slides/${classId}/summary.pdf`}
						download
						leftSection={<IconDownload size={16} />}
					>
						Download
					</Button> */}
					<Button onClick={handleDownload} leftSection={<IconDownload size={16} />}>Download</Button>
				</Stack>
			</Modal>
		</>
	)
}