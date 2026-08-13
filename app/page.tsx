'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  ReactFlowInstance,
  NodeResizer,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { domToPng } from 'modern-screenshot';
import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabaseClient';
import LoginForm from '@/app/components/LoginForm';
import AccountPanel from '@/app/components/AccountPanel';
import type { Session } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'react-hot-toast';
import {
  FolderOpen,
  Plus,
  Save,
  FileDown,
  User,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// --- Type pour les données d'un Nœud ---
interface CustomNodeData {
  firstName: string;
  lastName: string;
  jobTitle: string;
  photoUrl: string;
  onChange: (id: string, field: string, value: string) => void;
  onPhotoUpload: (id: string, file: File) => void;
  onDeleteNode: (id: string) => void;
}

// --- Composant Carte Personne Personnalisée (avec animations) ---
const PersonNode = ({ id, data, selected }: { id: string; data: CustomNodeData; selected?: boolean }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <motion.div
      className="w-full h-auto min-w-[120px] box-border bg-white border-2 border-slate-300 rounded-lg p-2 shadow-md flex flex-col items-center gap-1 relative group"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.2, type: 'spring', stiffness: 500 }}
    >
      {/* Bouton de suppression */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          data.onDeleteNode?.(id);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          data.onDeleteNode?.(id);
        }}
        title="Supprimer la carte"
        className={`absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-xs font-bold rounded-full flex items-center justify-center transition shadow-md z-30 cursor-pointer ${
          selected ? 'opacity-100 scale-110' : 'opacity-80 sm:opacity-0 sm:group-hover:opacity-100'
        }`}
      >
        <X className="w-3 h-3" />
      </button>

      {/* Poignées de redimensionnement */}
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        maxWidth={400}
        minHeight={110}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#2563eb', border: '1px solid white' }}
        lineStyle={{ borderColor: '#2563eb' }}
      />

      {/* Points d'ancrage */}
      <Handle type="target" position={Position.Top} className="w-3.5 h-3.5 !bg-blue-600 !border-2 !border-white cursor-pointer" />
      <Handle type="source" position={Position.Bottom} className="w-3.5 h-3.5 !bg-blue-600 !border-2 !border-white cursor-pointer" />

      {/* Photo de profil */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 cursor-pointer relative group-hover:opacity-90 transition"
        title="Cliquer pour changer la photo"
      >
        <img
          src={data.photoUrl || 'https://via.placeholder.com/150?text=Photo'}
          alt={`${data.lastName} ${data.firstName}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-[9px] text-center font-medium">
          Changer
        </div>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            data.onPhotoUpload(id, e.target.files[0]);
          }
        }}
      />

      {/* Champs éditables */}
      <div className="w-full flex flex-col gap-1 text-[11px]">
        <div className="flex gap-1 justify-center">
          <input
            type="text"
            value={data.lastName}
            onChange={(e) => data.onChange(id, 'lastName', e.target.value)}
            placeholder="Nom"
            className="w-1/2 text-right font-bold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none bg-transparent"
          />
          <input
            type="text"
            value={data.firstName}
            onChange={(e) => data.onChange(id, 'firstName', e.target.value)}
            placeholder="Prénom"
            className="w-1/2 font-bold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none bg-transparent"
          />
        </div>
        <input
          type="text"
          value={data.jobTitle}
          onChange={(e) => data.onChange(id, 'jobTitle', e.target.value)}
          placeholder="Intitulé du poste"
          className="text-slate-500 text-center text-[10px] border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none bg-transparent"
        />
      </div>
    </motion.div>
  );
};

const nodeTypes = { personNode: PersonNode };

export default function OrganigrammePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>('Chargement...');
  const [projectList, setProjectList] = useState<{ id: string; title: string; updated_at: string }[]>([]);
  const [projectsModalOpen, setProjectsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [edgeDeleteTarget, setEdgeDeleteTarget] = useState<Edge | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [saving, setSaving] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // --- Authentification ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
      if (event === 'SIGNED_OUT' || !newSession) {
        setProjectId(null);
        setProjectTitle('Chargement...');
        setProjectList([]);
        setNodes([]);
        setEdges([]);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // --- Projets ---
  const refreshProjectList = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Erreur chargement liste projets:', error.message);
      return [];
    }
    setProjectList(data || []);
    return data || [];
  }, []);

  const openProject = useCallback(async (project: { id: string; title: string }) => {
    setNodes([]);
    setEdges([]);
    setProjectId(project.id);
    setProjectTitle(project.title);
    await loadNodesFromDb(project.id);
    setProjectsModalOpen(false);
    toast.success(`Projet "${project.title}" chargé`);
  }, []);

  const createNewProject = useCallback(async () => {
    if (!session) return;
    const { data: newProj, error } = await supabase
      .from('projects')
      .insert([{ title: 'Nouvel Organigramme', user_id: session.user.id }])
      .select()
      .single();

    if (error || !newProj) {
      toast.error('Erreur création : ' + error?.message);
      return;
    }
    await refreshProjectList();
    await openProject(newProj);
    toast.success('Nouveau projet créé');
  }, [refreshProjectList, openProject, session]);

  const confirmDeleteProject = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('projects').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      const updatedList = await refreshProjectList();
      if (deleteTarget.id === projectId) {
        if (updatedList.length > 0) {
          await openProject(updatedList[0]);
        } else {
          setProjectId(null);
          setProjectTitle('Chargement...');
          setNodes([]);
          setEdges([]);
        }
      }
      setDeleteTarget(null);
      toast.success('Projet supprimé');
    } catch (err: any) {
      toast.error('Erreur lors de la suppression : ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // --- Initialisation ---
  useEffect(() => {
    if (!session) return;

    async function initProject() {
      const projects = await refreshProjectList();
      let currentProject = projects.length > 0 ? projects[0] : null;

      if (!currentProject) {
        const { data: newProj } = await supabase
          .from('projects')
          .insert([{ title: 'Mon Organigramme', user_id: session!.user.id }])
          .select()
          .single();
        currentProject = newProj;
        if (currentProject) await refreshProjectList();
      }

      if (currentProject) {
        await openProject(currentProject);
      }
    }

    initProject();
  }, [session]);

  // --- Chargement des nœuds ---
  const loadNodesFromDb = async (pId: string) => {
    const { data: dbNodes, error } = await supabase
      .from('nodes')
      .select('*')
      .eq('project_id', pId);

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
  };

  // --- Gestion des données ---
  const handleNodeDataChange = useCallback(
    (id: string, field: string, value: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: { ...node.data, [field]: value },
            };
          }
          return node;
        })
      );
    },
    []
  );

  const handlePhotoUpload = useCallback(async (id: string, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${id}-${Math.random()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('photos_employes')
      .upload(filePath, file);

    if (uploadError) {
      toast.error('Erreur téléversement image: ' + uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('photos_employes')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, photoUrl: publicUrl },
          };
        }
        return node;
      })
    );
    toast.success('Photo mise à jour');
  }, []);

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    toast.success('Carte supprimée');
  }, []);

  // --- React Flow events ---
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removals = changes.filter((change) => change.type === 'remove');
      const others = changes.filter((change) => change.type !== 'remove');

      if (others.length > 0) {
        setEdges((eds) => applyEdgeChanges(others, eds));
      }

      if (removals.length > 0) {
        const idToRemove = (removals[0] as { id: string }).id;
        setEdges((currentEdges) => {
          const target = currentEdges.find((e) => e.id === idToRemove);
          if (target) setEdgeDeleteTarget(target);
          return currentEdges;
        });
      }
    },
    []
  );

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

  // --- Ajouter une personne ---
  const addPerson = () => {
    const newId = crypto.randomUUID();

    let flowX = 250 + Math.random() * 40;
    let flowY = 150 + Math.random() * 40;

    if (rfInstance && printRef.current) {
      const bounds = printRef.current.getBoundingClientRect();
      const screenCenter = {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      };
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
  };

  // --- Sauvegarde ---
  const saveProject = async () => {
    if (!projectId) return;
    setSaving(true);

    try {
      const parentMap = new Map<string, string>();
      edges.forEach((edge) => {
        parentMap.set(edge.target, edge.source);
      });

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

      await refreshProjectList();
      toast.success('Organigramme enregistré avec succès !');
    } catch (err: any) {
      toast.error('Erreur lors de la sauvegarde : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Export PDF ---
  const exportPDF = async () => {
    if (!printRef.current || !rfInstance) return;
    rfInstance.fitView();

    setTimeout(async () => {
      const element = printRef.current;
      if (!element) return;

      const dataUrl = await domToPng(element, {
        scale: 2,
        backgroundColor: '#f1f5f9',
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => (img.onload = res));

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [img.width, img.height],
      });
      pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
      pdf.save(`${projectTitle.toLowerCase().replace(/\s+/g, '-')}.pdf`);
      toast.success('PDF exporté avec succès');
    }, 300);
  };

  // --- Garde d'authentification ---
  if (authLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <motion.div
          className="text-slate-600 text-sm font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
        >
          Chargement...
        </motion.div>
      </div>
    );
  }

  if (!session) {
    return <LoginForm onLoggedIn={() => {}} />;
  }

  return (
    <div className="w-full h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 font-sans overflow-hidden">
      <Toaster position="top-right" reverseOrder={false} />

      {/* Barre d'outils modernisée */}
      <motion.div
        className="p-4 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm flex flex-wrap gap-4 items-center justify-between sticky top-0 z-20"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-4 flex-wrap">
          {/* Bouton Mes projets */}
          <motion.button
            onClick={() => setProjectsModalOpen(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700 transition flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <FolderOpen className="w-4 h-4" />
            Mes projets
          </motion.button>

          {/* Titre du projet */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="text-xl font-bold text-slate-800 border-b-2 border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none bg-transparent min-w-[120px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <motion.button
            onClick={addPerson}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </motion.button>

          <motion.button
            onClick={saveProject}
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-500 transition shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Save className="w-4 h-4" />
            {saving ? 'En cours...' : 'Enregistrer'}
          </motion.button>

          <motion.button
            onClick={exportPDF}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-500 transition shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FileDown className="w-4 h-4" />
            PDF
          </motion.button>

          <motion.button
            onClick={() => setAccountOpen(true)}
            title="Mon compte"
            className="w-10 h-10 flex items-center justify-center bg-slate-200 text-slate-700 rounded-full hover:bg-slate-300 transition shadow-sm hover:shadow cursor-pointer text-sm font-bold"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <User className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.div>

      {/* Zone Canvas */}
      <div className="flex-1 w-full h-full relative" ref={printRef}>
        {/* Logo statique inclus dans l'export */}
        <img
          src="/logo-mdg.jpg"
          alt="Logo MDG Services"
          draggable={false}
          className="absolute top-3 left-3 h-10 w-auto select-none pointer-events-none z-10"
        />

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          className="bg-gradient-to-br from-slate-50/50 to-slate-100/50"
        >
          <Background color="#94a3b8" gap={16} className="opacity-30" />
          <Controls className="!bg-slate-800 !border-slate-700 [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!fill-white [&>button:hover]:!bg-slate-700" />
        </ReactFlow>
      </div>

      <style jsx global>{`
        .react-flow__controls-button {
          background-color: #1e293b !important;
          border-bottom: 1px solid #334155 !important;
        }
        .react-flow__controls-button svg {
          fill: #ffffff !important;
        }
        .react-flow__controls-button:hover {
          background-color: #334155 !important;
        }
      `}</style>

      {/* MODALE "Mes projets" animée */}
      <AnimatePresence>
        {projectsModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setProjectsModalOpen(false)}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-white/30"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-blue-600" />
                  Mes projets
                </h2>
                <button
                  onClick={() => setProjectsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition p-1 rounded-full hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4">
                <motion.button
                  onClick={createNewProject}
                  className="w-full text-center px-4 py-3 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-500 transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus className="w-4 h-4" />
                  Nouveau projet
                </motion.button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-2">
                {projectList.length === 0 && (
                  <div className="px-4 py-6 text-sm text-slate-400 text-center">Aucun projet</div>
                )}
                {projectList.map((p) => (
                  <motion.div
                    key={p.id}
                    className={`flex items-center justify-between gap-2 border rounded-xl px-4 py-3 transition ${
                      p.id === projectId
                        ? 'border-blue-400 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 hover:bg-slate-50/80'
                    }`}
                    whileHover={{ scale: 1.01 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button
                      onClick={() => openProject(p)}
                      className="flex-1 text-left flex flex-col min-w-0"
                    >
                      <span className="font-semibold text-slate-800 truncate">{p.title}</span>
                      <span className="text-xs text-slate-400">
                        Modifié le {new Date(p.updated_at).toLocaleDateString('fr-FR')}
                      </span>
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: p.id, title: p.title })}
                      title="Supprimer ce projet"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Popup de confirmation suppression projet */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-white/30"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <h3 className="text-lg font-bold text-slate-800 mb-2">Confirmer la suppression</h3>
              <p className="text-sm text-slate-600 mb-5">
                Voulez-vous vraiment supprimer <span className="font-semibold">{deleteTarget.title}</span> ?
                Cette action est irréversible.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDeleteProject}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-xl transition shadow-md disabled:opacity-50"
                >
                  {deleting ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Popup de confirmation suppression liaison */}
      <AnimatePresence>
        {edgeDeleteTarget && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-white/30"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <h3 className="text-lg font-bold text-slate-800 mb-2">Supprimer la liaison</h3>
              <p className="text-sm text-slate-600 mb-5">
                Voulez-vous vraiment supprimer cette liaison hiérarchique ?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setEdgeDeleteTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDeleteEdge}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-xl transition shadow-md"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panneau "Mon compte" */}
      {accountOpen && session && (
        <AccountPanel
          email={session.user.email || ''}
          onClose={() => setAccountOpen(false)}
          onLoggedOut={() => setAccountOpen(false)}
        />
      )}
    </div>
  );
}