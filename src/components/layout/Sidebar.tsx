import { Search, Plus, FolderOpen, Clock, Trash2, Edit3, FolderInput, ChevronRight, ChevronDown, PanelLeftClose, LogOut, MoreVertical, Check, X, User as UserIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import logoIcon from '../../assets/gambar2.png';

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
}

interface SidebarProps {
  onToggle: () => void;
  user: User | null;
  onAuthModalOpen: () => void;
  onSignOut: () => void;
  conversations: Array<{ id: string; title: string; projectId?: string | null }>;
  projects: Project[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onNewChat: () => void;
  onCreateProject: (name: string) => void;
  onMoveToProject: (conversationId: string, projectId: string | null) => void;
}

export function Sidebar({
  onToggle, user, onAuthModalOpen, onSignOut, conversations, projects, activeId,
  onSelect, onDelete, onRename, onNewChat,
  onCreateProject, onMoveToProject,
}: SidebarProps) {
  const [search, setSearch] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [moveMenu, setMoveMenu] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const newProjectRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (showNewProject && newProjectRef.current) newProjectRef.current.focus();
  }, [showNewProject]);

  useEffect(() => {
    if (renameId && renameInputRef.current) renameInputRef.current.focus();
  }, [renameId]);

  // Close menus on outside click
  useEffect(() => {
    const handleClick = () => { setActiveMenu(null); setMoveMenu(null); };
    if (activeMenu || moveMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [activeMenu, moveMenu]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setActiveMenu(null); setMoveMenu(null); setShowNewProject(false); setRenameId(null); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const filteredConversations = search
    ? conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const ungrouped = filteredConversations.filter(c => !c.projectId);
  const groupedByProject = (projectId: string) => filteredConversations.filter(c => c.projectId === projectId);

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewProject(false);
    }
  };

  const startRename = (convId: string, currentTitle: string) => {
    setRenameId(convId);
    setRenameValue(currentTitle);
    setActiveMenu(null);
  };

  const confirmRename = () => {
    if (renameId && renameValue.trim()) {
      onRename(renameId, renameValue.trim());
    }
    setRenameId(null);
    setRenameValue('');
  };

  const handleMenuToggle = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === convId ? null : convId);
    setMoveMenu(null);
  };

  const handleMoveClick = (convId: string) => {
    setMoveMenu(convId);
  };

  const handleMove = (conversationId: string, projectId: string | null) => {
    onMoveToProject(conversationId, projectId);
    setMoveMenu(null);
    setActiveMenu(null);
  };

  // Render conversation item with three-dot menu
  const renderConvItem = (conv: { id: string; title: string; projectId?: string | null }) => {
    const isRenaming = renameId === conv.id;
    const isMenuOpen = activeMenu === conv.id;
    const isMoveOpen = moveMenu === conv.id;

    return (
      <div key={conv.id} className="relative group">
        {isRenaming ? (
          /* Inline rename input */
          <div className="flex items-center gap-1 px-2 py-1">
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmRename();
                if (e.key === 'Escape') { setRenameId(null); setRenameValue(''); }
              }}
              onBlur={confirmRename}
              className="flex-1 px-2 py-1 text-xs bg-bg border border-primary/30 rounded-lg outline-none"
            />
            <button onClick={confirmRename} className="p-0.5 text-primary hover:text-primary-light">
              <Check size={12} />
            </button>
            <button onClick={() => { setRenameId(null); setRenameValue(''); }} className="p-0.5 text-text-dim hover:text-text">
              <X size={12} />
            </button>
          </div>
        ) : (
          /* Normal chat item */
          <button
            onClick={() => onSelect(conv.id)}
            className={`w-full flex items-center gap-1 pr-1 text-left rounded-lg text-xs transition-colors btn-press ${
              activeId === conv.id
                ? 'bg-primary/10 text-primary font-medium py-1.5 px-3'
                : 'text-text-muted hover:text-text hover:bg-bg-alt py-1.5 px-3'
            }`}
          >
            <span className="flex-1 truncate">{conv.title}</span>
            {/* Three-dot menu button — always visible on mobile, hover on desktop */}
            <button
              ref={(el) => { menuButtonRefs.current[conv.id] = el; }}
              onClick={(e) => handleMenuToggle(e, conv.id)}
              className={`p-0.5 rounded text-text-dim hover:text-text hover:bg-border/50 transition-colors ${
                isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 max-md:opacity-100'
              }`}
            >
              <MoreVertical size={12} />
            </button>
          </button>
        )}

        {/* Dropdown menu */}
        <AnimatePresence>
          {isMenuOpen && !isMoveOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-2 top-full z-[150] bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[160px]"
            >
              <button
                onClick={() => startRename(conv.id, conv.title)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors"
              >
                <Edit3 size={14} />
                Ganti nama
              </button>
              <button
                onClick={() => handleMoveClick(conv.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors"
              >
                <FolderInput size={14} />
                Pindah ke Proyek
              </button>
              <div className="mx-2 my-1 border-t border-border" />
              <button
                onClick={() => { onDelete(conv.id); setActiveMenu(null); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
                Hapus
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Move to Project sub-menu */}
        <AnimatePresence>
          {isMoveOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-2 top-full z-[150] bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[180px] max-h-[200px] overflow-y-auto"
            >
              <div className="px-3 py-1.5 text-[10px] text-text-dim font-medium uppercase">Pindahkan ke</div>
              <button
                onClick={() => handleMove(conv.id, null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors"
              >
                <Clock size={14} />
                Riwayat
              </button>
              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => handleMove(conv.id, project.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors"
                >
                  <FolderOpen size={14} />
                  {project.name}
                </button>
              ))}
              {projects.length === 0 && (
                <div className="px-3 py-2 text-xs text-text-dim italic">Buat proyek dulu di Pustaka</div>
              )}
              <div className="mx-2 my-1 border-t border-border" />
              <button
                onClick={() => setMoveMenu(null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-dim hover:bg-bg-alt transition-colors"
              >
                ← Kembali
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <>
      <aside className="w-[260px] h-full bg-surface border-r border-border flex flex-col relative max-md:pt-3">
        {/* Header */}
        <div className="px-4 pb-3 pt-4 md:pt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img src={logoIcon} alt="Lyra" className="w-8 h-8 rounded-xl object-contain" />
              <span className="font-semibold text-text text-base">Lyra</span>
            </div>
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-alt transition-colors btn-press"
              title="Tutup sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-white
              hover:bg-primary-hover transition-all shadow-soft text-sm font-medium btn-press"
          >
            <Plus size={16} />
            Chat baru
          </button>
        </div>

        {/* Search */}
        <div className="px-4 mb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari percakapan..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-bg border border-border rounded-xl
                text-text placeholder:text-text-dim outline-none focus:border-primary/30 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text text-xs btn-press"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 mb-2 overflow-y-auto flex-1">
          {/* Pustaka */}
          <div>
            <button
              onClick={() => {
                const allExpanded = projects.every(p => expandedProjects[p.id]);
                if (allExpanded) {
                  setExpandedProjects({});
                } else {
                  const next: Record<string, boolean> = {};
                  projects.forEach(p => { next[p.id] = true; });
                  setExpandedProjects(next);
                }
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm text-text-muted hover:text-text hover:bg-bg-alt transition-colors btn-press"
            >
              <div className="flex items-center gap-3">
                <FolderOpen size={16} />
                <span className="font-medium">Pustaka</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNewProject(true);
                  }}
                  className="p-1 rounded-lg hover:bg-primary/10 text-text-dim hover:text-primary transition-colors btn-press"
                >
                  <Plus size={14} />
                </button>
                {projects.length > 0 && (
                  projects.every(p => expandedProjects[p.id])
                    ? <ChevronDown size={14} className="text-text-dim" />
                    : <ChevronRight size={14} className="text-text-dim" />
                )}
              </div>
            </button>

            {/* New Project Input */}
            {showNewProject && (
              <div className="px-3 py-2">
                <input
                  ref={newProjectRef}
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateProject();
                    if (e.key === 'Escape') { setShowNewProject(false); setNewProjectName(''); }
                  }}
                  onBlur={() => {
                    if (newProjectName.trim()) handleCreateProject();
                    else setShowNewProject(false);
                  }}
                  placeholder="Nama proyek baru..."
                  className="w-full px-3 py-2 text-xs bg-bg border border-primary/30 rounded-lg
                    text-text placeholder:text-text-dim outline-none transition-colors"
                />
              </div>
            )}

            {/* Project List */}
            {projects.map(project => (
              <div key={project.id}>
                <button
                  onClick={() => toggleProject(project.id)}
                  className="w-full flex items-center justify-between pl-9 pr-3 py-1.5 rounded-lg text-sm text-text-muted hover:text-text hover:bg-bg-alt transition-colors btn-press"
                >
                  <span className="truncate">{project.name}</span>
                  <span className="text-[10px] text-text-dim bg-bg-alt px-1.5 py-0.5 rounded-md">
                    {groupedByProject(project.id).length}
                  </span>
                </button>

                {/* Conversations in project */}
                {expandedProjects[project.id] && (
                  <div className="pl-6 pr-1">
                    {groupedByProject(project.id).length === 0 && (
                      <div className="text-[10px] text-text-dim py-1 italic">Belum ada percakapan</div>
                    )}
                    {groupedByProject(project.id).map(conv => renderConvItem(conv))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Riwayat */}
          <div className="mt-1">
            <button
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-text-muted hover:text-text hover:bg-bg-alt transition-colors btn-press"
            >
              <Clock size={16} />
              <span className="font-medium">Riwayat</span>
            </button>

            <div className="px-1">
              {ungrouped.length === 0 && !search && (
                <div className="text-[10px] text-text-dim py-2 italic">Belum ada percakapan</div>
              )}
              {ungrouped.length === 0 && search && (
                <div className="text-[10px] text-text-dim py-2 italic">Tidak ditemukan</div>
              )}
              {ungrouped.map(conv => renderConvItem(conv))}
            </div>
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-border">
          {user ? (
            <div className="flex items-center gap-3 px-1 py-1.5 rounded-xl hover:bg-bg-alt transition-colors">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-soft flex-shrink-0">
                <span className="text-white font-bold text-xs">
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">{user.email}</div>
              </div>
              <button
                onClick={onSignOut}
                className="p-1.5 rounded-lg text-text-dim hover:text-accent-maroon hover:bg-red-50 transition-colors btn-press flex-shrink-0"
                title="Keluar"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={onAuthModalOpen}
              className="w-full flex items-center gap-3 px-1 py-1.5 rounded-xl hover:bg-bg-alt transition-colors btn-press text-left"
            >
              <div className="w-8 h-8 rounded-xl bg-bg-alt border border-border flex items-center justify-center flex-shrink-0">
                <UserIcon size={14} className="text-text-dim" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-muted">Guest Mode</div>
              </div>
              <ChevronRight size={14} className="text-text-dim flex-shrink-0" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
