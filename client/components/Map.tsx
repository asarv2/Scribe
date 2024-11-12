/**
 * Map.tsx
 * Will be used to show the mindmap of each of the classes
 * @AshokSaravanan222
 * 11-12-2024
 */


import ELK, { ElkNode, LayoutOptions } from 'elkjs/lib/elk.bundled.js'
import { PropsWithChildren, useCallback, useEffect } from 'react'
import ReactFlow, {
	Background,
	BackgroundVariant,
	Controls,
	Edge,
	Node,
	Position,
	useEdgesState,
	useNodesState,
	useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { NodeComponent } from '@/components/NodeComponent'
import { FlatMapNode, MapNode } from '@/utils/map/map-tree'

const elk = new ELK()

const useLayoutedElements = () => {
	const { getNodes, setNodes, getEdges, fitView, setCenter, zoomTo } =
		useReactFlow()
	const getLayoutedElements = useCallback(
		async (options: LayoutOptions) => {
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
			let rootNodePosition = { x: 0, y: 0 }
			const { children } = await elk.layout(graph)
			// By mutating the children in-place we saves ourselves from creating a
			// needless copy of the nodes array.
			// @ts-ignore
			children.forEach(node => {
				if (typeof (node as any).parentNodeId === 'undefined') {
					console.log('rootNodePosition', node)
					rootNodePosition = { x: node.x!, y: node.y! }
				}
				// @ts-ignore
				node.position = { x: node.x, y: node.y }
			})
			// @ts-ignore
			setNodes(children)
			setTimeout(() => {
				setCenter(rootNodePosition.x, rootNodePosition.y)
				zoomTo(1)
			})
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

const flattenMapNode = (node: MapNode): FlatMapNode[] => {
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
		position: { x: 0, y: 0 },
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
			targetHandle: node.id,
			sourceHandle: node.parentId!,
		}))
}

export type MapProps = {
	rootNode: MapNode
	onNodeClick?: (nodeLabel: string, description: string) => void
}

export const Map: React.FC<PropsWithChildren<MapProps>> = ({
	rootNode,
	onNodeClick,
	children,
}) => {
	const { fitView, setViewport, getNode, viewportInitialized } = useReactFlow()
	const [nodes, , onNodesChange] = useNodesState(createMap(rootNode))
	const [edges, , onEdgesChange] = useEdgesState(createEdge(rootNode))
	const { getLayoutedElements } = useLayoutedElements()

	useEffect(() => {
		console.log('viewportInitialized', viewportInitialized)
		if (viewportInitialized) {
			setTimeout(
				() =>
					getLayoutedElements({
						'elk.algorithm': 'org.eclipse.elk.stress',
						// @ts-ignore
						'org.eclipse.elk.stress.desiredEdgeLength': 200,
					}),
				100,
			)
		}
	}, [getLayoutedElements, viewportInitialized])

	return (
		<ReactFlow
			snapGrid={[16, 16]}
			nodes={nodes}
			edges={edges}
			onNodesChange={onNodesChange}
			onEdgesChange={onEdgesChange}
			fitView
			fitViewOptions={{ padding: 20 }}
			nodeTypes={NODE_TYPES}
			onNodeClick={(e, n) => onNodeClick?.(n.data.label, n.data.description)}
		>
			<Controls showInteractive={true} />
			<Background variant={BackgroundVariant.Dots} gap={16} size={1} />
			{children}
		</ReactFlow>
	)
}