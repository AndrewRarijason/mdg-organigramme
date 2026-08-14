'use client';

import { useCallback, useRef, useState } from 'react';
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
export function useOrganigramme() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [edgeDeleteTarget, setEdgeDeleteTarget] = useState<Edge | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [saving, setSaving] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const resetCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, []);

  // --- Édition des champs d'une carte ---
  const handleNodeDataChange = useCallback((id: string, field: string, value: string) => {
    setNodes((nds) =>
      nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, [field]: value } } : node))
    );
  }, []);

  const handlePhotoUpload = useCallback(async (id: string, file: File) => {
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

    setNodes((nds) =>
      nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, photoUrl: publicUrl } } : node))
    );
    toast.success('Photo mise à jour');
  }, []);

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    toast.success('Carte supprimée');
  }, []);

  // --- Chargement depuis Supabase ---
  const loadNodesFromDb = useCallback(
    async (pId: string) => {
      const { data: dbNodes, error } = await supabase.from('nodes').select('*').eq('project_id', pId);

      if (error) {
        console.error('Erreur chargement nodes:', error);
        return;
      }
      if (!dbNodes || dbNodes.length === 0) return;

      const loadedNodes: Node[] = dbNodes.map((item) => ({
        id: item.id,
        type: 'personNode',
        position: { x: item.position_x, y: item.position_y },
        style: item.width ? { width: item.width, ...(item.height ? { height: item.height } : {}) } : { width: 180 },
        data: {
          firstName: item.first_name || '',
          lastName: item.last_name || '',
          jobTitle: item.job_title || '',
          photoUrl: item.photo_url || '',
          onChange: handleNodeDataChange,
          onPhotoUpload: handlePhotoUpload,
          onDeleteNode: handleDeleteNode,
        },
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
    },
    [handleNodeDataChange, handlePhotoUpload, handleDeleteNode]
  );

  // --- Événements React Flow ---
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
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
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, animated: true, interactionWidth: 30 }, eds)),
    []
  );

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setEdgeDeleteTarget(edge);
  }, []);

  const confirmDeleteEdge = useCallback(() => {
    if (!edgeDeleteTarget) return;
    setEdges((eds) => eds.filter((e) => e.id !== edgeDeleteTarget.id));
    setEdgeDeleteTarget(null);
    toast.success('Liaison supprimée');
  }, [edgeDeleteTarget]);

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
      data: {
        firstName: 'Nouveau',
        lastName: 'Membre',
        jobTitle: 'Poste',
        photoUrl: '',
        onChange: handleNodeDataChange,
        onPhotoUpload: handlePhotoUpload,
        onDeleteNode: handleDeleteNode,
      },
    };

    setNodes((nds) => nds.concat(newNode));
    toast.success('Nouvelle carte ajoutée');
  }, [rfInstance, handleNodeDataChange, handlePhotoUpload, handleDeleteNode]);

  // --- Sauvegarde ---
  const saveProject = useCallback(
    async (projectId: string | null, projectTitle: string, onSaved?: () => Promise<unknown> | unknown) => {
      if (!projectId) return;
      setSaving(true);
      try {
        const parentMap = new Map<string, string>();
        edges.forEach((edge) => parentMap.set(edge.target, edge.source));

        const payload = nodes.map((n) => ({
          id: n.id,
          project_id: projectId,
          first_name: n.data.firstName || '',
          last_name: n.data.lastName || '',
          job_title: n.data.jobTitle || '',
          photo_url: n.data.photoUrl || '',
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
        toast.success('Organigramme enregistré avec succès !');
      } catch (err: any) {
        toast.error('Erreur lors de la sauvegarde : ' + err.message);
      } finally {
        setSaving(false);
      }
    },
    [nodes, edges]
  );

  // --- Export PDF ---
  const exportPDF = useCallback(
    async (projectTitle: string) => {
      if (!printRef.current || !rfInstance) return;
      rfInstance.fitView();

      setTimeout(async () => {
        const element = printRef.current;
        if (!element) return;

        const dataUrl = await domToPng(element, { scale: 2, backgroundColor: '#f1f5f9' });

        const img = new Image();
        img.src = dataUrl;
        await new Promise((res) => (img.onload = res));

        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [img.width, img.height] });
        pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
        pdf.save(`${projectTitle.toLowerCase().replace(/\s+/g, '-')}.pdf`);
        toast.success('PDF exporté avec succès');
      }, 300);
    },
    [rfInstance]
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
  };
}