'use client';

import React from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';

import LoginForm from '@/app/components/LoginForm';
import AccountPanel from '@/app/components/AccountPanel';
import { nodeTypes } from '@/app/components/organigramme/PersonneNode';
import { Toolbar } from '@/app/components/organigramme/Toolbar';
import { ProjectsModal } from '@/app/components/organigramme/ProjectsModal';
import { ConfirmDeleteDialog } from '@/app/components/organigramme/ConfirmDeleteDialog';

import { useAuthSession } from '@/app/hooks/useAuthSession';
import { useOrganigramme } from '@/app/hooks/useOrganigramme';
import { useProjects } from '@/app/hooks/useProjects';
import { useAutoSave } from '@/app/hooks/useAutoSave';

import { useState } from 'react';

export default function OrganigrammePage() {
  const [accountOpen, setAccountOpen] = useState(false);

  const organigramme = useOrganigramme();
  const { session, authLoading } = useAuthSession(() => organigramme.resetCanvas());

  const projects = useProjects(
    session,
    (projectId) => organigramme.loadNodesFromDb(projectId),
    () => organigramme.resetCanvas()
  );

  const { lastAutoSavedAt, autoSaving } = useAutoSave({
    enabled: !!projects.projectId,
    nodes: organigramme.nodes,
    edges: organigramme.edges,
    resetKey: projects.projectId,
    onSave: () =>
      organigramme.saveProject(projects.projectId, projects.projectTitle, projects.refreshProjectList, {
        silent: true,
      }),
    delayMs: 4000,
  });

  const initializedUserIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const userId = session?.user?.id ?? null;

    if (userId && initializedUserIdRef.current !== userId) {
      initializedUserIdRef.current = userId;
      projects.initProjects();
    }

    if (!userId) {
      initializedUserIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

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
    return <LoginForm onLoggedIn={() => { }} />;
  }

  return (
    <div className="w-full h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 font-sans overflow-hidden">
      <Toaster
        position="top-center"
        containerStyle={{ top: 75 }}
        toastOptions={{
          duration: 3000,
          style: {
            background: '#f1f5f9',
            color: '#1e293b',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          },
        }}
      />

      <Toolbar
        projectTitle={projects.projectTitle}
        onProjectTitleChange={projects.setProjectTitle}
        onOpenProjectsModal={() => projects.setProjectsModalOpen(true)}
        onAddPerson={organigramme.addPerson}
        onUndo={organigramme.undo}
        onRedo={organigramme.redo}
        canUndo={organigramme.canUndo}
        canRedo={organigramme.canRedo}
        onSave={() => organigramme.saveProject(projects.projectId, projects.projectTitle, projects.refreshProjectList)}
        saving={organigramme.saving}
        autoSaving={autoSaving}
        lastAutoSavedAt={lastAutoSavedAt}
        onExportPDF={() => organigramme.exportPDF(projects.projectTitle)}
        exportingPdf={organigramme.exportingPdf}
        exportPdfProgress={organigramme.exportPdfProgress}
        onOpenAccount={() => setAccountOpen(true)}
      />

      {/* Zone Canvas */}
      <div className="flex-1 w-full h-full relative" ref={organigramme.printRef}>
        <img
          src="/mdg-logo/mdgservices-logo.png"
          alt="Logo MDG Services"
          draggable={false}
          className="absolute top-2 left-2 md:top-3 md:left-3 h-6 md:h-10 w-auto select-none pointer-events-none z-10"
        />

        <ReactFlow
          nodes={organigramme.nodes}
          edges={organigramme.edges}
          onNodesChange={organigramme.onNodesChange}
          onEdgesChange={organigramme.onEdgesChange}
          onConnect={organigramme.onConnect}
          onEdgeClick={organigramme.onEdgeClick}
          onInit={organigramme.setRfInstance}
          nodeTypes={nodeTypes}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          proOptions={{ hideAttribution: true }}
          ariaLabelConfig={{
            'controls.ariaLabel': 'Contrôles du canevas',
            'controls.zoomIn.ariaLabel': 'Zoom avant',
            'controls.zoomOut.ariaLabel': 'Zoom arrière',
            'controls.fitView.ariaLabel': "Ajuster à l'écran",
            'controls.interactive.ariaLabel': "Activer ou désactiver l'interactivité",
          }}
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

      <ProjectsModal
        open={projects.projectsModalOpen}
        onClose={() => projects.setProjectsModalOpen(false)}
        projectList={projects.projectList}
        activeProjectId={projects.projectId}
        onCreateNew={projects.createNewProject}
        onOpenProject={projects.openProject}
        onRequestDelete={projects.setDeleteTarget}
      />

      <ConfirmDeleteDialog
        open={!!projects.deleteTarget}
        title="Confirmer la suppression"
        message={
          <>
            Voulez-vous vraiment supprimer{' '}
            <span className="font-semibold">{projects.deleteTarget?.title}</span> ? Cette action est
            irréversible.
          </>
        }
        loading={projects.deleting}
        onCancel={() => projects.setDeleteTarget(null)}
        onConfirm={projects.confirmDeleteProject}
      />

      <ConfirmDeleteDialog
        open={!!organigramme.edgeDeleteTarget}
        title="Supprimer la liaison"
        message="Voulez-vous vraiment supprimer cette liaison hiérarchique ?"
        onCancel={() => organigramme.setEdgeDeleteTarget(null)}
        onConfirm={organigramme.confirmDeleteEdge}
      />

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