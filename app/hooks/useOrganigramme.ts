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
import { getLayoutedElements } from '@/app/lib/autoLayout';

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
    hierarchyLevel: number | null; // ← AJOUTÉ : conservé pour undo/redo pendant la session
    layoutSide: 'left' | 'right' | null;
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

  // Empêche de committer plusieurs fois pendant un même geste continu
  // (drag ou resize) : on ne veut capturer le snapshot "avant" qu'une
  // seule fois, au tout premier événement du geste.
  const gestureCommitPendingRef = useRef(false);

  // Après une édition de contenu (nom/poste) qui peut faire grandir une
  // carte (retour à la ligne), on ne connaît la VRAIE hauteur qu'une fois
  // React Flow ayant re-mesuré le DOM après le rendu — pas au moment où
  // on vient de changer le texte. Ce ref mémorise quelle carte attendre
  // et sa hauteur mesurée AVANT l'édition, pour déclencher un second
  // recalcul de disposition dès que la nouvelle hauteur réelle est connue
  // (voir l'effet plus bas). Ainsi les rangées suivantes descendent bien
  // si la carte s'est agrandie, au lieu de laisser la liaison du bas
  // passer derrière la carte.
  const pendingRelayoutRef = useRef<{ nodeId: string; previousHeight: number | undefined } | null>(null);

  const updateHistoryFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const buildNodeData = useCallback(
    (base: {
      firstName: string;
      lastName: string;
      jobTitle: string;
      photoUrl: string;
      hierarchyLevel?: number | null; // ← AJOUTÉ
      layoutSide?: 'left' | 'right' | null;
    }) => ({
      lastName: base.lastName || '',
      firstName: base.firstName || '',
      jobTitle: base.jobTitle || '',
      photoUrl: base.photoUrl || '',
      hierarchyLevel: base.hierarchyLevel ?? null, // ← AJOUTÉ : null = placement automatique
      layoutSide: base.layoutSide ?? null,
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
        hierarchyLevel: (node.data as any)?.hierarchyLevel ?? null, // ← AJOUTÉ
        layoutSide: (node.data as any)?.layoutSide ?? null,
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

  // Second passage de disposition après une édition de texte : attend que
  // React Flow ait vraiment re-mesuré la carte éditée (retour à la ligne
  // éventuel) avant de recalculer les positions Y et les branchY, pour
  // que les niveaux suivants descendent si la carte a grandi.
  useEffect(() => {
    const pending = pendingRelayoutRef.current;
    if (!pending || isRestoringRef.current || gestureCommitPendingRef.current) return;
    const node = nodes.find((n) => n.id === pending.nodeId);
    if (!node) {
      pendingRelayoutRef.current = null;
      return;
    }
    const measuredHeight = node.measured?.height;
    // Toujours la même hauteur qu'avant l'édition : la vraie mesure post-
    // rendu n'est pas encore arrivée, on attend le prochain passage.
    if (measuredHeight === undefined || measuredHeight === pending.previousHeight) return;
    pendingRelayoutRef.current = null;
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodesRef.current,
      edgesRef.current
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [nodes]);

  const resetCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    clearHistory();
    gestureCommitPendingRef.current = false;
    pendingRelayoutRef.current = null;
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
  const loadNodesFromDb = useCallback(async (pId: string) => {
    const [{ data: dbNodes }, { data: dbEdges }] = await Promise.all([
      supabase.from('nodes').select('*').eq('project_id', pId),
      supabase.from('edges').select('*').eq('project_id', pId),
    ]);

    if (!dbNodes || dbNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      clearHistory();
      gestureCommitPendingRef.current = false;
      pendingRelayoutRef.current = null;
      return;
    }

    // 1. Reconstruire les edges React Flow à partir de la table Supabase `edges`
    const loadedEdges: Edge[] = (dbEdges || []).map((item) => ({
      id: item.id || `e-${item.source_id}-${item.target_id}`,
      source: item.source_id,
      target: item.target_id,
      type: 'orgEdge',
      animated: true,
      interactionWidth: 30,
      data: { routingMode: item.routing_mode || 'independent' },
    }));

    // 2. Reconstruire les nodes
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
        hierarchyLevel: item.hierarchy_level ?? null,
        layoutSide: item.layout_side ?? null,
      }),
    }));

    // 3. Recalculer la disposition et réinsérer les données de contournement (bypassX / branchY)
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      loadedNodes,
      loadedEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    clearHistory();
    gestureCommitPendingRef.current = false;
    pendingRelayoutRef.current = null;
  }, [buildNodeData, clearHistory]);

  // Un changement 'remove' doit toujours committer (peu importe le geste).
  const hasRemoveChange = useCallback((changes: NodeChange[]) => {
    return changes.some((change) => change.type === 'remove');
  }, []);

  // Début d'un geste continu (drag ou resize) : c'est LE moment où il faut
  // capturer le snapshot "avant", car nodesRef.current reflète encore la
  // position/taille d'origine (aucune mise à jour n'a encore eu lieu).
  const isGestureStart = useCallback((changes: NodeChange[]) => {
    return changes.some((change) => {
      if (change.type === 'position') {
        const posChange = change as NodeChange & { dragging?: boolean };
        return posChange.dragging === true;
      }
      if (change.type === 'dimensions') {
        // IMPORTANT : React Flow émet aussi des changements 'dimensions'
        // automatiquement lors de la simple mesure d'une carte (création,
        // chargement, restauration undo/redo) — ces mesures n'ont PAS la
        // propriété `resizing`. Seul un vrai redimensionnement utilisateur
        // via NodeResizer la passe explicitement (true pendant le
        // glissement, false à son relâchement).
        const dimChange = change as NodeChange & { resizing?: boolean };
        return dimChange.resizing === true;
      }
      return false;
    });
  }, []);

  // Fin d'un geste continu : sert uniquement à réarmer
  // gestureCommitPendingRef pour le prochain drag/resize.
  const isGestureEnd = useCallback((changes: NodeChange[]) => {
    return changes.some((change) => {
      if (change.type === 'position') {
        const posChange = change as NodeChange & { dragging?: boolean };
        return posChange.dragging === false;
      }
      if (change.type === 'dimensions') {
        const dimChange = change as NodeChange & { resizing?: boolean };
        return dimChange.resizing === false;
      }
      return false;
    });
  }, []);

  // --- Événements React Flow ---
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!isRestoringRef.current) {
        if (hasRemoveChange(changes)) {
          commitHistory();
        } else if (isGestureStart(changes) && !gestureCommitPendingRef.current) {
          // BUG CORRIGÉ : on committe ICI, au premier événement du geste
          // (dragging/resizing === true), et non plus à sa fin. À ce
          // stade, nodesRef.current contient encore la position/taille
          // AVANT le déplacement — c'est bien ce snapshot-là que l'undo
          // doit pouvoir restaurer. Auparavant, le commit avait lieu sur
          // l'événement de fin (dragging === false), mais chaque
          // événement intermédiaire du drag applique déjà la nouvelle
          // position en continu via setNodes, donc nodesRef.current
          // reflétait déjà la position D'ARRIVÉE : le snapshot "avant"
          // enregistré était en réalité identique à l'état courant, et
          // l'undo ne ramenait nulle part.
          gestureCommitPendingRef.current = true;
          commitHistory();
        }
        if (isGestureEnd(changes)) {
          gestureCommitPendingRef.current = false;
        }
      }
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [commitHistory, hasRemoveChange, isGestureStart, isGestureEnd]
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
      const newEdge: Edge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}`,
        type: 'orgEdge',
        animated: true,
        interactionWidth: 30,
      };
      const updatedEdges = addEdge(newEdge, edgesRef.current);

      // Recalcule la disposition et les couloirs de contournement
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodesRef.current,
        updatedEdges
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
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
    const updatedEdges = edgesRef.current.filter((e) => e.id !== edgeDeleteTarget.id);

    // Recalcule la disposition lors de la suppression d'une liaison
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodesRef.current,
      updatedEdges
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setEdgeDeleteTarget(null);
    toast.success('Liaison supprimée');
  }, [edgeDeleteTarget, commitHistory]);

  // --- Fonction utilitaire : Calculer le niveau hiérarchique réel d'un nœud ---
  const getNodeDepth = useCallback((nodeId: string, allEdges: Edge[]): number => {
    const parentEdges = allEdges.filter((e) => e.target === nodeId);
    if (parentEdges.length === 0) return 1;
    const parentDepths = parentEdges.map((e) => getNodeDepth(e.source, allEdges));
    return Math.max(...parentDepths) + 1;
  }, []);

  // --- Ajouter une personne vide (Niveau 1) ---
  const addPerson = useCallback(() => {
    const newId = crypto.randomUUID();
    const Y_START = 50;
    const X_START = 50;
    const X_SPACING = 220;

    // Compter les cartes réellement au niveau 1
    const level1Nodes = nodesRef.current.filter(
      (n) => getNodeDepth(n.id, edgesRef.current) === 1
    );

    const flowX = X_START + level1Nodes.length * X_SPACING;

    const newNode: Node = {
      id: newId,
      type: 'personNode',
      position: { x: flowX, y: Y_START },
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
  }, [buildNodeData, commitHistory, getNodeDepth]);

  // --- Ajouter un employé via le formulaire (upload photo + edge parent +
  //     recalcul automatique de la disposition de tout l'arbre) ---
  const addEmployeeFromForm = useCallback(
    async (formData: {
      firstName: string;
      lastName: string;
      jobTitle: string;
      photoFile: File | null;
      parentIds: string[];
      layoutSide?: 'left' | 'right' | null;
      routingMode?: 'independent' | 'shared';
      hierarchyLevel?: number | null; // ← AJOUTÉ : niveau 1-indexé, null = automatique
    }) => {
      const newId = crypto.randomUUID();
      let photoUrl = '';

      if (formData.photoFile) {
        const fileExt = formData.photoFile.name.split('.').pop();
        const fileName = `${newId}-${Math.random()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('photos_employes')
          .upload(filePath, formData.photoFile);

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('photos_employes')
            .getPublicUrl(filePath);
          photoUrl = publicUrlData.publicUrl;
        }
      }

      // 1. Création du nœud avec une position temporaire (0,0) — le
      //    niveau hiérarchique forcé (si fourni) est stocké dans data, et
      //    lu par computeDepths dans getLayoutedElements ci-dessous.
      const newNode: Node = {
        id: newId,
        type: 'personNode',
        position: { x: 0, y: 0 },
        style: { width: 180 },
        data: buildNodeData({
          firstName: formData.firstName,
          lastName: formData.lastName,
          jobTitle: formData.jobTitle,
          photoUrl,
          layoutSide: formData.layoutSide ?? null,
          hierarchyLevel: formData.hierarchyLevel ?? null, // ← AJOUTÉ
        }),
      };

      // 2. Création des nouvelles liaisons
      const newEdges: Edge[] = formData.parentIds.map((pId) => ({
        id: `e-${pId}-${newId}`,
        source: pId,
        target: newId,
        type: 'orgEdge',
        animated: true,
        interactionWidth: 30,
        data: { routingMode: formData.routingMode ?? 'independent' },
      }));

      // 3. On ajoute temporairement les nouveaux éléments aux listes existantes
      const updatedNodes = nodesRef.current.concat(newNode);
      const updatedEdges = edgesRef.current.concat(newEdges);

      // 4. On passe le tout à getLayoutedElements, qui respecte le niveau
      //    forcé sur le nouveau nœud (s'il y en a un) et place tous les
      //    autres nœuds normalement autour.
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        updatedNodes,
        updatedEdges
      );

      // 5. On sauvegarde dans l'historique et on met à jour l'état React Flow
      commitHistory();
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      toast.success("Employé ajouté et organigramme réorganisé");
    },
    [buildNodeData, commitHistory]
  );

  // --- Modifier un employé existant depuis le formulaire (nom, prénom,
  //     poste, photo, et éventuellement son supérieur hiérarchique) ---
  const updateEmployee = useCallback(
    async (
      id: string,
      updates: {
        firstName: string;
        lastName: string;
        jobTitle: string;
        photoFile: File | null;
        parentIds: string[];
        layoutSide?: 'left' | 'right' | null;
        routingMode?: 'independent' | 'shared';
        hierarchyLevel?: number | null; // ← Ajouté
      }
    ) => {
      commitHistory();

      const previousMeasuredHeight = nodesRef.current.find((n) => n.id === id)?.measured?.height;

      let photoUrl: string | undefined;
      if (updates.photoFile) {
        const fileExt = updates.photoFile.name.split('.').pop();
        const fileName = `${id}-${Math.random()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('photos_employes')
          .upload(filePath, updates.photoFile);

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('photos_employes')
            .getPublicUrl(filePath);
          photoUrl = publicUrlData.publicUrl;
        }
      }

      const withoutOldEdges = edgesRef.current.filter((e) => e.target !== id);
      const newEdges: Edge[] = updates.parentIds.map((pId) => ({
        id: `e-${pId}-${id}`,
        source: pId,
        target: id,
        type: 'orgEdge',
        animated: true,
        interactionWidth: 30,
        data: { routingMode: updates.routingMode ?? 'independent' },
      }));
      const finalEdges = withoutOldEdges.concat(newEdges);

      const updatedNodesRaw = nodesRef.current.map((node) =>
        node.id === id
          ? {
            ...node,
            data: {
              ...node.data,
              firstName: updates.firstName,
              lastName: updates.lastName,
              jobTitle: updates.jobTitle,
              hierarchyLevel: updates.hierarchyLevel ?? null, // ← Ajouté : applique le niveau forcé
              layoutSide: updates.layoutSide ?? null,
              ...(photoUrl ? { photoUrl } : {}),
            },
          }
          : node
      );

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        updatedNodesRaw,
        finalEdges
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      pendingRelayoutRef.current = { nodeId: id, previousHeight: previousMeasuredHeight };

      toast.success('Employé mis à jour');
    },
    [commitHistory]
  );

  // --- Supprimer un employé depuis le formulaire (supprime uniquement ses
  //     liaisons directes ; ses descendants restent dans l'arbre, sans
  //     supérieur — même comportement que handleDeleteNode) ---
  const deleteEmployee = useCallback(
    (id: string) => {
      handleDeleteNode(id);
    },
    [handleDeleteNode]
  );

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
        // 1. Mise à jour des nœuds avec le niveau hiérarchique
        const payloadNodes = nodes.map((n) => ({
          id: n.id,
          project_id: projectId,
          first_name: (n.data as any).firstName || '',
          last_name: (n.data as any).lastName || '',
          job_title: (n.data as any).jobTitle || '',
          photo_url: (n.data as any).photoUrl || '',
          position_x: n.position.x,
          position_y: n.position.y,
          width: (n.style?.width as number) || n.measured?.width || 180,
          height: (n.style?.height as number) || n.measured?.height || null,
          layout_side: (n.data as any).layoutSide ?? null,
          hierarchy_level: (n.data as any).hierarchyLevel ?? null, // <-- AJOUTÉ : persiste le niveau/index
        }));

        if (payloadNodes.length > 0) {
          const nodeIds = payloadNodes.map((n) => n.id);
          await supabase
            .from('nodes')
            .delete()
            .eq('project_id', projectId)
            .not('id', 'in', `(${nodeIds.join(',')})`);

          const { error: nodeErr } = await supabase.from('nodes').upsert(payloadNodes, { onConflict: 'id' });
          if (nodeErr) throw nodeErr;
        } else {
          await supabase.from('nodes').delete().eq('project_id', projectId);
        }

        // 2. Synchronisation des relations (edges)
        const { error: deleteEdgeErr } = await supabase.from('edges').delete().eq('project_id', projectId);
        if (deleteEdgeErr) throw deleteEdgeErr;

        if (edges.length > 0) {
          const payloadEdges = edges.map((e) => ({
            project_id: projectId,
            source_id: e.source,
            target_id: e.target,
            routing_mode: (e.data as any)?.routingMode ?? 'independent',
          }));
          const { error: edgeErr } = await supabase.from('edges').insert(payloadEdges);
          if (edgeErr) throw edgeErr;
        }

        await supabase
          .from('projects')
          .update({ title: projectTitle, updated_at: new Date().toISOString() })
          .eq('id', projectId);

        if (onSaved) await onSaved();
        if (!options?.silent) toast.success('Organigramme enregistré avec succès !');
      } catch (err: any) {
        if (!options?.silent) toast.error('Erreur lors de la sauvegarde : ' + err.message);
      } finally {
        setSaving(false);
      }
    },
    [nodes, edges]
  );

  // --- Export PDF (via Puppeteer côté serveur) ---
  const exportPDF = useCallback(
    async (projectTitle: string) => {
      if (exportingPdf) return;

      setExportingPdf(true);
      setExportPdfProgress(10);

      let progressTimer: number | null = null;

      try {
        progressTimer = window.setInterval(() => {
          setExportPdfProgress((p) => (p < 85 ? p + 3 : p));
        }, 200);

        const response = await fetch('/api/export-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodes: nodesRef.current.map((n) => ({
              id: n.id,
              type: n.type,
              position: n.position,
              style: {
                width: (typeof n.style?.width === 'number' ? n.style.width : undefined) || n.measured?.width || 200,
                height: (typeof n.style?.height === 'number' ? n.style.height : undefined) || n.measured?.height || 130,
              },
              data: {
                firstName: (n.data as any)?.firstName || '',
                lastName: (n.data as any)?.lastName || '',
                jobTitle: (n.data as any)?.jobTitle || '',
                photoUrl: (n.data as any)?.photoUrl || '',
              },
            })),
            edges: edgesRef.current,
            title: projectTitle,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || `Échec de l'export (${response.status})`);
        }

        setExportPdfProgress(95);

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = projectTitle.toLowerCase().replace(/\s+/g, '-') + '.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        setExportPdfProgress(100);
        toast.success('PDF exporté avec succès');
      } catch (err: any) {
        toast.error('Erreur export PDF : ' + (err?.message || 'inconnue'));
      } finally {
        if (progressTimer !== null) window.clearInterval(progressTimer);
        await new Promise((res) => setTimeout(res, 400));
        setExportingPdf(false);
        setExportPdfProgress(0);
      }
    },
    [exportingPdf]
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
    addEmployeeFromForm,
    updateEmployee,
    deleteEmployee,
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
