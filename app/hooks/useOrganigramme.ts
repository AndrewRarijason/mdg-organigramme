'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  ReactFlowInstance,
} from '@xyflow/react';
import { domToPng } from 'modern-screenshot';
import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabaseClient';

/**
 * Toute la logique du canevas : chargement/sauvegarde des personnes et
 * liaisons, édition des cartes, ajout, suppression, export PDF.
 * Indépendant de la notion de "projet" (reçoit juste un projectId/titre).
 */

type SnapshotNode = {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number | null;
  data: {
    firstName: string;
    lastName: string;
    jobTitle: string;
    photoUrl: string;
  };
};

type FlowSnapshot = {
  nodes: SnapshotNode[];
  edges: Edge[];
};

const HISTORY_LIMIT = 50;

export function useOrganigramme() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [edgeDeleteTarget, setEdgeDeleteTarget] = useState<Edge | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [saving, setSaving] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfProgress, setExportPdfProgress] = useState(0);

  const printRef = useRef<HTMLDivElement>(null);

  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);
  // Synchronisation directe (pas de useEffect) : évite tout décalage d'un
  // tick entre l'état React et la valeur lue par commitHistory/makeSnapshot.
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const isRestoringRef = useRef(false);
  const pastRef = useRef<FlowSnapshot[]>([]);
  const futureRef = useRef<FlowSnapshot[]>([]);
  const textEditLockTimerRef = useRef<number | null>(null);

  const updateHistoryFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const buildNodeData = useCallback(
    (base: { firstName: string; lastName: string; jobTitle: string; photoUrl: string }) => ({
      lastName: base.lastName || '',
      firstName: base.firstName || '',
      jobTitle: base.jobTitle || '',
      photoUrl: base.photoUrl || '',
      onChange: handleNodeDataChange,
      onPhotoUpload: handlePhotoUpload,
      onDeleteNode: handleDeleteNode,
    }),
    []
  );

  const serializeNode = useCallback((node: Node): SnapshotNode => {
    const rawWidth =
      (typeof node.style?.width === 'number' ? node.style.width : undefined) || node.measured?.width || 180;
    const rawHeight =
      (typeof node.style?.height === 'number' ? node.style.height : undefined) || node.measured?.height || null;

    return {
      id: node.id,
      position: { x: node.position.x, y: node.position.y },
      width: rawWidth,
      height: rawHeight,
      data: {
        firstName: (node.data as any)?.firstName || '',
        lastName: (node.data as any)?.lastName || '',
        jobTitle: (node.data as any)?.jobTitle || '',
        photoUrl: (node.data as any)?.photoUrl || '',
      },
    };
  }, []);

  const deserializeNode = useCallback(
    (snapshotNode: SnapshotNode): Node => ({
      id: snapshotNode.id,
      type: 'personNode',
      position: snapshotNode.position,
      style:
        snapshotNode.height !== null
          ? { width: snapshotNode.width, height: snapshotNode.height }
          : { width: snapshotNode.width },
      data: buildNodeData(snapshotNode.data),
    }),
    [buildNodeData]
  );

  const makeSnapshot = useCallback(
    (sourceNodes: Node[] = nodesRef.current, sourceEdges: Edge[] = edgesRef.current): FlowSnapshot => ({
      nodes: sourceNodes.map(serializeNode),
      edges: sourceEdges.map((edge) => ({ ...edge })),
    }),
    [serializeNode]
  );

  const clearHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    updateHistoryFlags();
  }, [updateHistoryFlags]);

  const commitHistory = useCallback(
    (snapshot?: FlowSnapshot) => {
      if (isRestoringRef.current) return;
      const snap = snapshot ?? makeSnapshot();
      pastRef.current = [...pastRef.current, snap].slice(-HISTORY_LIMIT);
      futureRef.current = [];
      updateHistoryFlags();
    },
    [makeSnapshot, updateHistoryFlags]
  );

  const restoreSnapshot = useCallback(
    (snapshot: FlowSnapshot) => {
      isRestoringRef.current = true;
      setNodes(snapshot.nodes.map(deserializeNode));
      setEdges(snapshot.edges.map((edge) => ({ ...edge })));

      requestAnimationFrame(() => {
        isRestoringRef.current = false;
      });
    },
    [deserializeNode]
  );

  const undo = useCallback(() => {
    const previous = pastRef.current[pastRef.current.length - 1];
    if (!previous) return;

    const current = makeSnapshot();
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [current, ...futureRef.current].slice(0, HISTORY_LIMIT);

    restoreSnapshot(previous);
    updateHistoryFlags();
  }, [makeSnapshot, restoreSnapshot, updateHistoryFlags]);

  const redo = useCallback(() => {
    const next = futureRef.current[0];
    if (!next) return;

    const current = makeSnapshot();
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current, current].slice(-HISTORY_LIMIT);

    restoreSnapshot(next);
    updateHistoryFlags();
  }, [makeSnapshot, restoreSnapshot, updateHistoryFlags]);

  const scheduleTextEditHistoryCommit = useCallback(() => {
    if (textEditLockTimerRef.current === null) {
      commitHistory();
    }

    if (textEditLockTimerRef.current !== null) {
      window.clearTimeout(textEditLockTimerRef.current);
    }

    textEditLockTimerRef.current = window.setTimeout(() => {
      textEditLockTimerRef.current = null;
    }, 300);
  }, [commitHistory]);

  useEffect(() => {
    return () => {
      if (textEditLockTimerRef.current !== null) {
        window.clearTimeout(textEditLockTimerRef.current);
      }
    };
  }, []);

  const resetCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    clearHistory();
  }, [clearHistory]);

  // --- Édition des champs d'une carte ---
  const handleNodeDataChange = useCallback(
    (id: string, field: string, value: string) => {
      scheduleTextEditHistoryCommit();
      setNodes((nds) =>
        nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, [field]: value } } : node))
      );
    },
    [scheduleTextEditHistoryCommit]
  );

  const handlePhotoUpload = useCallback(
    async (id: string, file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('photos_employes').upload(filePath, file);
      if (uploadError) {
        toast.error('Erreur téléversement image: ' + uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('photos_employes').getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      commitHistory();
      setNodes((nds) =>
        nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, photoUrl: publicUrl } } : node))
      );
      toast.success('Photo mise à jour');
    },
    [commitHistory]
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      commitHistory();
      setNodes((nds) => nds.filter((node) => node.id !== id));
      setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
      toast.success('Carte supprimée');
    },
    [commitHistory]
  );

  // --- Chargement depuis Supabase ---
  const loadNodesFromDb = useCallback(
    async (pId: string) => {
      const { data: dbNodes, error } = await supabase.from('nodes').select('*').eq('project_id', pId);

      if (error) {
        console.error('Erreur chargement nodes:', error);
        return;
      }

      if (!dbNodes || dbNodes.length === 0) {
        setNodes([]);
        setEdges([]);
        clearHistory();
        return;
      }

      const loadedNodes: Node[] = dbNodes.map((item) => ({
        id: item.id,
        type: 'personNode',
        position: { x: item.position_x, y: item.position_y },
        style: item.width ? { width: item.width, ...(item.height ? { height: item.height } : {}) } : { width: 180 },
        data: buildNodeData({
          firstName: item.first_name || '',
          lastName: item.last_name || '',
          jobTitle: item.job_title || '',
          photoUrl: item.photo_url || '',
        }),
      }));

      const loadedEdges: Edge[] = dbNodes
        .filter((item) => item.parent_id !== null)
        .map((item) => ({
          id: `e-${item.parent_id}-${item.id}`,
          source: item.parent_id as string,
          target: item.id,
          animated: true,
          interactionWidth: 30,
        }));

      setNodes(loadedNodes);
      setEdges(loadedEdges);
      clearHistory();
    },
    [buildNodeData, clearHistory]
  );

  const shouldCommitNodeChanges = useCallback((changes: NodeChange[]) => {
    return changes.some((change) => {
      if (change.type === 'remove') {
        return true;
      }

      if (change.type === 'position') {
        const posChange = change as NodeChange & { dragging?: boolean };
        return posChange.dragging === false;
      }

      if (change.type === 'dimensions') {
        // IMPORTANT : React Flow émet aussi des changements 'dimensions'
        // automatiquement lors de la simple mesure d'une carte (création,
        // chargement, restauration undo/redo) — ces mesures n'ont PAS la
        // propriété `resizing`. Seul un vrai redimensionnement utilisateur
        // via NodeResizer la passe explicitement (true pendant le
        // glissement, false à son relâchement). On ne commite donc QUE
        // sur la fin explicite d'un redimensionnement volontaire.
        const dimChange = change as NodeChange & { resizing?: boolean };
        return dimChange.resizing === false;
      }

      return false;
    });
  }, []);

  // --- Événements React Flow ---
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!isRestoringRef.current && shouldCommitNodeChanges(changes)) {
        commitHistory();
      }
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [commitHistory, shouldCommitNodeChanges]
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removals = changes.filter((change) => change.type === 'remove');
    const others = changes.filter((change) => change.type !== 'remove');

    if (others.length > 0) setEdges((eds) => applyEdgeChanges(others, eds));

    if (removals.length > 0) {
      const idToRemove = (removals[0] as { id: string }).id;
      setEdges((currentEdges) => {
        const target = currentEdges.find((e) => e.id === idToRemove);
        if (target) setEdgeDeleteTarget(target);
        return currentEdges;
      });
    }
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      commitHistory();
      setEdges((eds) => addEdge({ ...connection, animated: true, interactionWidth: 30 }, eds));
    },
    [commitHistory]
  );

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setEdgeDeleteTarget(edge);
  }, []);

  const confirmDeleteEdge = useCallback(() => {
    if (!edgeDeleteTarget) return;
    commitHistory();
    setEdges((eds) => eds.filter((e) => e.id !== edgeDeleteTarget.id));
    setEdgeDeleteTarget(null);
    toast.success('Liaison supprimée');
  }, [edgeDeleteTarget, commitHistory]);

  // --- Ajouter une personne (centrée dans la zone visible) ---
  const addPerson = useCallback(() => {
    const newId = crypto.randomUUID();
    let flowX = 250 + Math.random() * 40;
    let flowY = 150 + Math.random() * 40;

    if (rfInstance && printRef.current) {
      const bounds = printRef.current.getBoundingClientRect();
      const screenCenter = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      const flowCenter = rfInstance.screenToFlowPosition(screenCenter);
      const cardWidth = 180;
      const cardHeight = 130;
      flowX = flowCenter.x - cardWidth / 2 + (Math.random() * 20 - 10);
      flowY = flowCenter.y - cardHeight / 2 + (Math.random() * 20 - 10);
    }

    const newNode: Node = {
      id: newId,
      type: 'personNode',
      position: { x: flowX, y: flowY },
      style: { width: 180 },
      data: buildNodeData({
        lastName: 'Nom',
        firstName: 'Prénom',
        jobTitle: 'Poste',
        photoUrl: '',
      }),
    };

    commitHistory();
    setNodes((nds) => nds.concat(newNode));
    toast.success('Nouvelle carte ajoutée');
  }, [rfInstance, buildNodeData, commitHistory]);

  // --- Raccourcis clavier globaux ---
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      if (!ctrlOrMeta) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  // --- Sauvegarde ---
  const saveProject = useCallback(
    async (
      projectId: string | null,
      projectTitle: string,
      onSaved?: () => Promise<unknown> | unknown,
      options?: { silent?: boolean }
    ) => {
      if (!projectId) return;
      setSaving(true);
      try {
        const parentMap = new Map<string, string>();
        edges.forEach((edge) => parentMap.set(edge.target, edge.source));

        const payload = nodes.map((n) => ({
          id: n.id,
          project_id: projectId,
          first_name: (n.data as any).firstName || '',
          last_name: (n.data as any).lastName || '',
          job_title: (n.data as any).jobTitle || '',
          photo_url: (n.data as any).photoUrl || '',
          parent_id: parentMap.get(n.id) || null,
          position_x: n.position.x,
          position_y: n.position.y,
          width: (n.style?.width as number) || n.measured?.width || 180,
          height: (n.style?.height as number) || n.measured?.height || null,
        }));

        if (payload.length > 0) {
          const { error } = await supabase.from('nodes').upsert(payload, { onConflict: 'id' });
          if (error) throw error;
        }

        await supabase
          .from('projects')
          .update({ title: projectTitle, updated_at: new Date().toISOString() })
          .eq('id', projectId);

        if (onSaved) await onSaved();
        if (!options?.silent) toast.success('Organigramme enregistré avec succès !');
      } catch (err: any) {
        if (!options?.silent) toast.error('Erreur lors de la sauvegarde : ' + err.message);
        else console.error('Erreur auto-save :', err.message);
      } finally {
        setSaving(false);
      }
    },
    [nodes, edges]
  );

  // --- Export PDF ---
  const exportPDF = useCallback(
    async (projectTitle: string) => {
      if (!printRef.current || !rfInstance || exportingPdf) return;

      setExportingPdf(true);
      setExportPdfProgress(5);

      const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

      try {
        rfInstance.fitView();
        setExportPdfProgress(15);

        await wait(300);

        const element = printRef.current;
        if (!element) throw new Error('Zone de capture introuvable');

        setExportPdfProgress(25);

        const attribution = element.querySelector('.react-flow__attribution') as HTMLElement | null;
        const flowRoot = element.querySelector('.react-flow') as HTMLElement | null;
        const dottedBackground = element.querySelector('.react-flow__background') as HTMLElement | null;

        // AJOUT: masque les outils React Flow (zoom, fit view, etc.)
        const controls = element.querySelector('.react-flow__controls') as HTMLElement | null;

        const previousAttributionDisplay = attribution?.style.display;
        const previousFlowBackground = flowRoot?.style.background;
        const previousElementBackground = element.style.background;
        const previousDottedDisplay = dottedBackground?.style.display;

        // AJOUT
        const previousControlsDisplay = controls?.style.display;

        let progressTimer: number | null = null;

        try {
          if (attribution) attribution.style.display = 'none';
          if (dottedBackground) dottedBackground.style.display = 'none';

          // AJOUT
          if (controls) controls.style.display = 'none';

          if (flowRoot) flowRoot.style.background = '#ffffff';
          element.style.background = '#ffffff';

          setExportPdfProgress(35);

          progressTimer = window.setInterval(() => {
            setExportPdfProgress((p) => (p < 90 ? p + 3 : p));
          }, 120);

          const dataUrl = await domToPng(element, {
            scale: 2,
            backgroundColor: '#ffffff',
          });

          if (progressTimer !== null) {
            window.clearInterval(progressTimer);
          }

          setExportPdfProgress(92);

          const img = new Image();
          img.src = dataUrl;
          await new Promise((res) => {
            img.onload = res;
          });

          setExportPdfProgress(97);

          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [img.width, img.height],
          });

          pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
          pdf.save(projectTitle.toLowerCase().replace(/\s+/g, '-') + '.pdf');

          setExportPdfProgress(100);
          toast.success('PDF exporté avec succès');
        } finally {
          if (progressTimer !== null) {
            window.clearInterval(progressTimer);
          }

          if (attribution) attribution.style.display = previousAttributionDisplay ?? '';
          if (dottedBackground) dottedBackground.style.display = previousDottedDisplay ?? '';

          // AJOUT
          if (controls) controls.style.display = previousControlsDisplay ?? '';

          if (flowRoot) flowRoot.style.background = previousFlowBackground ?? '';
          element.style.background = previousElementBackground;
        }
      } catch (err: any) {
        toast.error('Erreur export PDF : ' + (err?.message || 'inconnue'));
      } finally {
        await wait(400);
        setExportingPdf(false);
        setExportPdfProgress(0);
      }
    },
    [rfInstance, exportingPdf]
  );

  return {
    nodes,
    edges,
    edgeDeleteTarget,
    setEdgeDeleteTarget,
    rfInstance,
    setRfInstance,
    saving,
    printRef,
    resetCanvas,
    loadNodesFromDb,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onEdgeClick,
    confirmDeleteEdge,
    addPerson,
    saveProject,
    exportPDF,
    exportingPdf,
    exportPdfProgress,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  };
}