'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ReactFlow, Background, Controls, ControlButton } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';

import LoginForm from '@/app/components/LoginForm';
import AccountPanel from '@/app/components/AccountPanel';
import { nodeTypes } from '@/app/components/organigramme/PersonneNode';
import { edgeTypes } from '@/app/components/organigramme/OrgEdge';
import { ExportModeProvider } from '@/app/lib/exportMode';
import { Toolbar } from '@/app/components/organigramme/Toolbar';
import { ProjectsModal } from '@/app/components/organigramme/ProjectsModal';
import { ConfirmDeleteDialog } from '@/app/components/organigramme/ConfirmDeleteDialog';
import { AddEmployeeModal, EmployeeFormData } from '@/app/components/organigramme/AddEmployeeModal';
import { EmployeeListModal } from '@/app/components/organigramme/Employeelistmodal';
import { EditEmployeeModal, EmployeeUpdateData } from '@/app/components/organigramme/Editemployeemodal';

import { useAuthSession } from '@/app/hooks/useAuthSession';
import { useOrganigramme } from '@/app/hooks/useOrganigramme';
import { useProjects } from '@/app/hooks/useProjects';
import { useAutoSave } from '@/app/hooks/useAutoSave';

export default function OrganigrammePage() {
  const [accountOpen, setAccountOpen] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [submittingEmployee, setSubmittingEmployee] = useState(false);
  const [employeeListOpen, setEmployeeListOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<any>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [employeeDeleteTarget, setEmployeeDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [isInteractive, setIsInteractive] = useState(false);

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

  const initializedUserIdRef = useRef<string | null>(null);
  useEffect(() => {
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

  const handleAddEmployee = async (formData: EmployeeFormData) => {
    setSubmittingEmployee(true);
    try {
      await organigramme.addEmployeeFromForm(formData);
      setAddEmployeeOpen(false);
    } finally {
      setSubmittingEmployee(false);
    }
  };

  const handleEditEmployee = async (id: string, updates: EmployeeUpdateData) => {
    setSubmittingEdit(true);
    try {
      await organigramme.updateEmployee(id, updates);
      setEditingNode(null);
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleConfirmDeleteEmployee = () => {
    if (!employeeDeleteTarget) return;
    organigramme.deleteEmployee(employeeDeleteTarget.id);
    setEmployeeDeleteTarget(null);
  };

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
        onAddPerson={() => setAddEmployeeOpen(true)}
        onOpenEmployeeList={() => setEmployeeListOpen(true)}
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

        <ExportModeProvider exporting={organigramme.exportingPdf}>
          <ReactFlow
            nodes={organigramme.nodes}
            edges={organigramme.edges}
            onNodesChange={organigramme.onNodesChange}
            onEdgesChange={organigramme.onEdgesChange}
            onConnect={organigramme.onConnect}
            onEdgeClick={organigramme.onEdgeClick}
            onInit={organigramme.setRfInstance}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView

            // --- On lie ces propriétés à notre état local ---
            nodesDraggable={isInteractive}
            nodesConnectable={isInteractive}
            elementsSelectable={isInteractive}

            defaultEdgeOptions={{
              type: 'orgEdge',
              animated: false,
              style: {
                stroke: '#205170',
                strokeWidth: 2.5,
              },
            }}
            connectionLineStyle={{
              stroke: '#205170',
              strokeWidth: 2.5,
              strokeDasharray: '6 4',
            }}
            proOptions={{ hideAttribution: true }}
            ariaLabelConfig={{
              'controls.ariaLabel': 'Contrôles du canevas',
              'controls.zoomIn.ariaLabel': 'Zoom avant',
              'controls.zoomOut.ariaLabel': 'Zoom arrière',
              'controls.fitView.ariaLabel': "Ajuster à l'écran",
            }}
            className="bg-gradient-to-br from-slate-50/50 to-slate-100/50"
          >
            <Background color="#94a3b8" gap={16} className="opacity-30" />

            <Controls
              showInteractive={false} // On masque le bouton par défaut
              className="!bg-[#1c3f57] !border-[#2d5573] [&>button]:!bg-[#1c3f57] [&>button]:!border-[#2d5573] [&>button]:!fill-white [&>button:hover]:!bg-[#245068]"
            >
              {/* On injecte notre propre bouton de verrouillage */}
              <ControlButton
                onClick={() => setIsInteractive(!isInteractive)}
                title={isInteractive ? "Verrouiller le canevas" : "Déverrouiller le canevas"}
                aria-label="Activer ou désactiver l'interactivité"
              >
                {isInteractive ? (
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    {/* Cadenas ouvert */}
                    <path d="M17 11v-4a5 5 0 0 0-10 0v2h2v-2a3 3 0 0 1 6 0v4H5v10h14V11h-2z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    {/* Cadenas fermé */}
                    <path d="M17 11V7a5 5 0 0 0-10 0v4H5v10h14V11h-2zm-8-4a3 3 0 0 1 6 0v4H9V7z" />
                  </svg>
                )}
              </ControlButton>
            </Controls>
          </ReactFlow>
        </ExportModeProvider>
      </div>

      <style jsx global>{`
        /* Lignes de liaison pleines et bien visibles */
        .react-flow__edge-path {
          stroke: #205170 !important;
          stroke-width: 2.5px !important;
          stroke-dasharray: none !important;
          stroke-linecap: round;
          transition: stroke 0.2s ease, stroke-width 0.2s ease;
        }

        /* Effet de survol sur la liaison */
        .react-flow__edge:hover .react-flow__edge-path {
          stroke: #2d6d94 !important;
          stroke-width: 3.5px !important;
          cursor: pointer;
        }

        /* Liaison sélectionnée */
        .react-flow__edge.selected .react-flow__edge-path {
          stroke: #e11d48 !important;
          stroke-width: 3.5px !important;
        }

        /* Boutons de contrôle React Flow */
        .react-flow__controls-button {
          background-color: #1c3f57 !important;
          border-bottom: 1px solid #2d5573 !important;
        }
        .react-flow__controls-button svg {
          fill: #ffffff !important;
        }
        .react-flow__controls-button:hover {
          background-color: #245068 !important;
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

      <AddEmployeeModal
        open={addEmployeeOpen}
        onClose={() => setAddEmployeeOpen(false)}
        existingNodes={organigramme.nodes}
        onSubmit={handleAddEmployee}
        submitting={submittingEmployee}
      />

      <EmployeeListModal
        open={employeeListOpen}
        onClose={() => setEmployeeListOpen(false)}
        nodes={organigramme.nodes}
        onEdit={(node) => {
          setEditingNode(node);
          setEmployeeListOpen(false);
        }}
        onRequestDelete={(target) => setEmployeeDeleteTarget(target)}
        onAddEmployee={() => setAddEmployeeOpen(true)}
      />

      <EditEmployeeModal
        open={!!editingNode}
        node={editingNode}
        allNodes={organigramme.nodes}
        edges={organigramme.edges}
        onClose={() => setEditingNode(null)}
        onSubmit={handleEditEmployee}
        submitting={submittingEdit}
      />

      <ConfirmDeleteDialog
        open={!!employeeDeleteTarget}
        title="Supprimer cet employé"
        message={
          <>
            Voulez-vous vraiment supprimer{' '}
            <span className="font-semibold">{employeeDeleteTarget?.label}</span> ? Ses liaisons seront
            supprimées, mais ses subordonnés resteront dans l'organigramme.
          </>
        }
        onCancel={() => setEmployeeDeleteTarget(null)}
        onConfirm={handleConfirmDeleteEmployee}
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