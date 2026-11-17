import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    ConnectionMode,
    SelectionMode,
    useReactFlow,
} from '@xyflow/react'

import { MarkdownNode } from '../Node/MarkdownNode.jsx'
import { StickyNode } from '../Node/StickyNode.jsx'
import { WikiNode } from '../Node/WikiNode.jsx'
import { AssetNode } from '../Node/AssetNode.jsx'
import { LinkNode } from '../Node/LinkNode.jsx'
import { GroupNode } from '../Node/GroupNode.jsx'
import { CanvasEdge } from '../Edge/CanvasEdge.jsx'
import { setReactFlowInstance } from './viewportHelpers.mjs'
import { selectNodes, selectEdges, selectIsEdit } from '../../store/selectors.mjs'
import { uploadCanvasAsset } from '../../model/assetUpload.mjs'

const NODE_TYPES = {
    text: MarkdownNode,
    sticky: StickyNode,
    file: WikiNode,
    asset: AssetNode,
    link: LinkNode,
    group: GroupNode,
}

const EDGE_TYPES = {
    canvasEdge: CanvasEdge,
    default: CanvasEdge,
    smoothstep: CanvasEdge,
}

export function Diagram({ store }) {
    const rawNodes = store(selectNodes)
    const rawEdges = store(selectEdges)
    const isEdit = store(selectIsEdit)
    const [isNarrowViewport, setIsNarrowViewport] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches === true
    ))

    const reactFlowInstance = useReactFlow()
    setReactFlowInstance(reactFlowInstance)

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
        const media = window.matchMedia('(max-width: 640px)')
        const handleViewportModeChange = () => setIsNarrowViewport(media.matches)
        handleViewportModeChange()
        media.addEventListener?.('change', handleViewportModeChange)
        return () => media.removeEventListener?.('change', handleViewportModeChange)
    }, [])

    useEffect(() => {
        reactFlowInstance.fitView({
            minZoom: isNarrowViewport ? 1 : 0.1,
            maxZoom: 1,
            padding: isNarrowViewport ? 0.08 : 0.2,
        })
    }, [isNarrowViewport, reactFlowInstance])

    const dragSnapshotRef = useRef(null)
    const resizeSnapshotRef = useRef(null)

    const handleResizeStart = useCallback(() => {
        document.querySelector('.canvas-v2-root')?.classList.add('is-resizing')
        const currentNodes = store.getState().nodes
        const currentEdges = store.getState().edges
        resizeSnapshotRef.current = {
            nodes: currentNodes.map(n => ({
                ...n,
                position: { ...n.position },
                style: { ...(n.style || {}) },
                data: { ...(n.data || {}) },
            })),
            edges: currentEdges.map(e => ({
                ...e,
                data: { ...(e.data || {}) },
            })),
        }
    }, [store])

    const handleResizeEnd = useCallback(() => {
        document.querySelector('.canvas-v2-root')?.classList.remove('is-resizing')
        if (resizeSnapshotRef.current) {
            store.getState().commitTransaction(resizeSnapshotRef.current)
            resizeSnapshotRef.current = null
        }
    }, [store])

    // Memoized actions for nodes to preserve referential stability
    const nodeActions = useMemo(() => ({
        onUpdateContent: (id, patch) => store.getState().updateNodeContent(id, patch),
        onDuplicate: (id) => store.getState().duplicateNodes(id),
        onDelete: (id) => store.getState().deleteNodes(id),
        onChangeColor: (id, color) => store.getState().setNodeColor(id, color),
        onSelectNode: (id) => store.getState().setSelectedNode(id),
        onResizeStart: handleResizeStart,
        onResizeEnd: handleResizeEnd,
    }), [store, handleResizeStart, handleResizeEnd])

    // Memoized actions for edges
    const edgeActions = useMemo(() => ({
        onChangeEdgeLabel: (id, label) => store.getState().updateEdgeLabel(id, label),
        onChangeEdgeStyle: (id, patch) => store.getState().updateEdgeStyle(id, patch),
        onDeleteEdge: (id) => store.getState().deleteEdges(id),
        onSelectEdge: (id) => store.getState().setSelectedEdge(id),
    }), [store])

    // Node actions injected into node.data
    const nodesWithData = useMemo(() => {
        return rawNodes.map(node => ({
            ...node,
            data: {
                ...node.data,
                isEdit,
                ...nodeActions,
            },
        }))
    }, [rawNodes, isEdit, nodeActions])

    // Edge actions injected into edge.data
    const edgesWithData = useMemo(() => {
        return rawEdges.map(edge => ({
            ...edge,
            data: {
                ...edge.data,
                isEdit,
                ...edgeActions,
            },
        }))
    }, [rawEdges, isEdit, edgeActions])

    const handleNodesChange = useCallback((changes) => {
        const nextNodes = changes.applyTo(store.getState().nodes).map(node => {
            const dimChange = changes.getForNode(node.id).find(c => c.type === 'dimensions')
            if (dimChange?.dimensions) {
                return {
                    ...node,
                    style: {
                        ...(node.style || {}),
                        width: Math.round(dimChange.dimensions.width),
                        height: Math.round(dimChange.dimensions.height),
                    },
                }
            }
            return node
        })
        store.getState().setNodes(nextNodes)
    }, [store])

    const handleEdgesChange = useCallback((changes) => {
        const nextEdges = changes.applyTo(store.getState().edges)
        store.getState().setEdges(nextEdges)
    }, [store])

    const handleSelectionChange = useCallback(({ nodes, edges }) => {
        store.getState().setSelection({
            nodeIds: nodes.map(n => n.id),
            edgeIds: edges.map(e => e.id),
        })
    }, [store])

    const handleNodeDragStart = useCallback(() => {
        const currentNodes = store.getState().nodes
        const currentEdges = store.getState().edges
        dragSnapshotRef.current = {
            nodes: currentNodes.map(n => ({
                ...n,
                position: { ...n.position },
                style: { ...(n.style || {}) },
                data: { ...(n.data || {}) },
            })),
            edges: currentEdges.map(e => ({
                ...e,
                data: { ...(e.data || {}) },
            })),
        }
    }, [store])

    const handleNodeDragStop = useCallback(() => {
        if (dragSnapshotRef.current) {
            store.getState().commitTransaction(dragSnapshotRef.current)
            dragSnapshotRef.current = null
        }
    }, [store])

    const handleConnect = useCallback((connection) => {
        if (!isEdit) return
        store.getState().connectNodes(connection)
    }, [isEdit, store])

    const handleReconnect = useCallback((oldEdge, newConnection) => {
        if (!isEdit) return
        store.getState().reconnectEdge(oldEdge.id, newConnection)
    }, [isEdit, store])

    const handlePaneClick = useCallback(() => {
        store.getState().clearSelection()
    }, [store])

    const handleCanvasDragOver = useCallback((e) => {
        if (!isEdit) return
        if (e.dataTransfer?.types?.includes('Files')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
        }
    }, [isEdit])

    const handleCanvasDrop = useCallback(async (e) => {
        if (!isEdit) return
        const files = Array.from(e.dataTransfer?.files || [])
        if (files.length === 0) return

        e.preventDefault()
        e.stopPropagation()

        const dropPos = reactFlowInstance.screenToFlowPosition({
            x: e.clientX,
            y: e.clientY,
        })

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const posX = Math.round(dropPos.x + i * 40)
            const posY = Math.round(dropPos.y + i * 40)

            const tempId = `node-${Date.now()}-${i}`
            store.getState().createNode({
                id: tempId,
                type: 'asset',
                x: posX,
                y: posY,
                david888: {
                    subType: 'asset',
                    asset: {
                        name: file.name,
                        size: file.size,
                    },
                },
            })

            uploadCanvasAsset(file)
                .then(result => {
                    store.getState().updateNodeContent(tempId, {
                        file: result.url,
                        david888: {
                            subType: 'asset',
                            asset: {
                                name: result.name,
                                mime: result.mime,
                                size: result.size,
                                provider: result.provider,
                            },
                        },
                    })
                })
                .catch(err => {
                    console.error('[Diagram] Dropped asset upload error:', err)
                })
        }
    }, [isEdit, reactFlowInstance, store])

    return (
        <div
            className="canvas-v2-container"
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
        >
            <ReactFlow
                nodes={nodesWithData}
                edges={edgesWithData}
                nodeTypes={NODE_TYPES}
                edgeTypes={EDGE_TYPES}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onSelectionChange={handleSelectionChange}
                onNodeClick={(e, node) => store.getState().setSelectedNode(node.id)}
                onEdgeClick={(e, edge) => store.getState().setSelectedEdge(edge.id)}
                onNodeDragStart={handleNodeDragStart}
                onNodeDragStop={handleNodeDragStop}
                onConnect={handleConnect}
                onReconnect={handleReconnect}
                onPaneClick={handlePaneClick}
                connectionMode={ConnectionMode.Loose}
                nodesDraggable={isEdit}
                nodesConnectable={isEdit}
                elementsSelectable={true}
                selectionOnDrag={isEdit}
                selectionMode={SelectionMode.Partial}
                selectionKeyCode={['Shift', 'Meta', 'Control']}
                multiSelectionKeyCode={['Meta', 'Control']}
                panOnDrag={[1, 2]}
                panActivationKeyCode="Space"
                elevateEdgesOnSelect={true}
                fitView
                fitViewOptions={{
                    minZoom: isNarrowViewport ? 1 : 0.1,
                    maxZoom: 1,
                    padding: isNarrowViewport ? 0.08 : 0.2,
                }}
                minZoom={0.1}
                maxZoom={2.5}
                deleteKeyCode={['Backspace', 'Delete']}
            >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
                <Controls showInteractive={false} position="bottom-left" />
                <MiniMap
                    nodeStrokeWidth={3}
                    zoomable
                    pannable
                    position="bottom-right"
                    style={{ width: 120, height: 80, margin: 16 }}
                />
            </ReactFlow>
        </div>
    )
}
