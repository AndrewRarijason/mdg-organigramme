'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ReactFlow, ReactFlowProvider, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from '@/app/components/organigramme/PersonneNode';
import { edgeTypes } from '@/app/components/organigramme/OrgEdge';
import { ExportModeProvider } from '@/app/lib/exportMode';

const MARGIN = 40;
const HEADER_HEIGHT = 56;
const LOGO_SECTION_HEIGHT = 56; // Hauteur dédiée uniquement au logo

function noop() { }

function hydrateNodes(rawNodes: any[]): Node[] {
    return rawNodes.map((n) => ({
        ...n,
        draggable: false,
        selectable: false,
        connectable: false,
        data: {
            ...n.data,
            onChange: noop,
            onPhotoUpload: noop,
            onDeleteNode: noop,
        },
    }));
}

function computeBounds(nodes: Node[], edges: Edge[]) {
    if (nodes.length === 0) return { minX: 0, minY: 0, width: 800, height: 600 };

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach((n) => {
        const width = (typeof n.style?.width === 'number' ? n.style.width : undefined) || 200;
        const height = (typeof n.style?.height === 'number' ? n.style.height : undefined) || 130;
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + width);
        maxY = Math.max(maxY, n.position.y + height);
    });

    edges.forEach((e) => {
        const bypassX = e.data?.bypassX as number | undefined;
        if (typeof bypassX === 'number' && !isNaN(bypassX)) {
            minX = Math.min(minX, bypassX);
            maxX = Math.max(maxX, bypassX);
        }
    });

    return {
        minX,
        minY,
        width: Math.ceil(maxX - minX) + MARGIN * 2,
        height: Math.ceil(maxY - minY) + MARGIN * 2,
    };
}

export default function PrintPage() {
    const params = useParams<{ exportId: string }>();
    const [nodes, setNodes] = useState<Node[] | null>(null);
    const [edges, setEdges] = useState<Edge[] | null>(null);
    const [title, setTitle] = useState('');
    const [fontsReady, setFontsReady] = useState(false);
    const [imagesReady, setImagesReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/export-cache/${params.exportId}`)
            .then((r) => {
                if (!r.ok) throw new Error('Export introuvable ou expiré');
                return r.json();
            })
            .then((data) => {
                setNodes(hydrateNodes(data.nodes || []));
                setEdges((data.edges || []).map((e: Edge) => ({ ...e, animated: false })));
                setTitle(data.title || '');
            })
            .catch((err) => setError(err.message));
    }, [params.exportId]);

    useEffect(() => {
        document.fonts.ready.then(() => setFontsReady(true));
    }, []);

    const bounds = useMemo(
        () => (nodes && edges ? computeBounds(nodes, edges) : null),
        [nodes, edges]
    );

    useEffect(() => {
        if (!nodes) return;
        const imgs = Array.from(document.querySelectorAll('img'));
        if (imgs.length === 0) {
            setImagesReady(true);
            return;
        }
        let remaining = imgs.length;
        const onDone = () => {
            remaining -= 1;
            if (remaining <= 0) setImagesReady(true);
        };
        imgs.forEach((img) => {
            if (img.complete) onDone();
            else {
                img.addEventListener('load', onDone, { once: true });
                img.addEventListener('error', onDone, { once: true });
            }
        });
    }, [nodes]);

    const ready = !!nodes && !!edges && !!bounds && fontsReady && imagesReady;

    if (error) {
        return <div style={{ padding: 40, color: '#b91c1c' }}>{error}</div>;
    }

    if (!nodes || !edges || !bounds) {
        return <div style={{ width: 100, height: 100 }} />;
    }

    return (
        <div
            style={{
                width: bounds.width,
                height: bounds.height + HEADER_HEIGHT + LOGO_SECTION_HEIGHT,
                background: '#ffffff',
            }}
            data-export-ready={ready ? 'true' : 'false'}
        >
            {/* 1. En-tête : Titre du projet centré */}
            <div
                style={{
                    height: HEADER_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 24px',
                    borderBottom: '1px solid #e2e8f0',
                    boxSizing: 'border-box',
                }}
            >
                {title && (
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#205170', fontFamily: 'inherit' }}>
                        {title}
                    </span>
                )}
            </div>

            {/* 2. Ligne dédiée au logo (place le logo avant le contenu) */}
            <div
                style={{
                    height: LOGO_SECTION_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 24px',
                    boxSizing: 'border-box',
                }}
            >
                <img
                    src={`${typeof window !== 'undefined' ? window.location.origin : ''}/mdg-logo/mdgservices-logo.png`}
                    alt="Logo MDG Services"
                    style={{
                        height: 36,
                        width: 'auto',
                    }}
                />
            </div>

            {/* 3. Zone Canvas : L'organigramme débute sous la ligne du logo */}
            <div style={{ width: bounds.width, height: bounds.height, position: 'relative' }}>
                <ExportModeProvider exporting>
                    <ReactFlowProvider>
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            nodeTypes={nodeTypes}
                            edgeTypes={edgeTypes}
                            nodesDraggable={false}
                            nodesConnectable={false}
                            elementsSelectable={false}
                            panOnDrag={false}
                            zoomOnScroll={false}
                            zoomOnPinch={false}
                            zoomOnDoubleClick={false}
                            preventScrolling={false}
                            proOptions={{ hideAttribution: true }}
                            defaultViewport={{ x: MARGIN - bounds.minX, y: MARGIN - bounds.minY, zoom: 1 }}
                            minZoom={1}
                            maxZoom={1}
                            defaultEdgeOptions={{
                                type: 'orgEdge',
                                animated: false,
                                style: { stroke: '#205170', strokeWidth: 2.5 },
                            }}
                        />
                    </ReactFlowProvider>
                </ExportModeProvider>
            </div>

            <style jsx global>{`
        .react-flow__edge-path {
          stroke: #205170 !important;
          stroke-width: 2.5px !important;
          stroke-dasharray: none !important;
          stroke-linecap: round;
        }
        html,
        body {
          margin: 0;
          background: #ffffff;
        }
      `}</style>
        </div>
    );
}