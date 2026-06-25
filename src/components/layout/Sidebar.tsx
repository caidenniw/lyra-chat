import { Search, Plus, FolderOpen, Clock, Trash2, Edit3, FolderInput, ChevronRight, ChevronDown, PanelLeftClose } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
}

interface SidebarProps {
  onToggle: () => void;
  conversations: Array<{ id: string; title: string; projectId?: string | null }>;
  projects: Project[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  onCreateProject: (name: string) => void;

  onMoveToProject: (conversationId: string, projectId: string | null) => void;
}

export function Sidebar({ 
  onToggle, conversations, projects, activeId,
  onSelect, onDelete, onNewChat,
  onCreateProject, onMoveToProject,
}: SidebarProps) {
  const [search, setSearch] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; conversationId: string } | null>(null);
  const [moveMenu, setMoveMenu] = useState<{ conversationId: string } | null>(null);

  const newProjectRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNewProject && newProjectRef.current) {
      newProjectRef.current.focus();
    }
  }, [showNewProject]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => { setContextMenu(null); setMoveMenu(null); };
    if (contextMenu || moveMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu, moveMenu]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setContextMenu(null); setMoveMenu(null); setShowNewProject(false); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Filter conversations by search
  const filteredConversations = search
    ? conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  // Group conversations
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

  const handleContextMenu = (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, conversationId });
    setMoveMenu(null);
  };

  const handleMoveClick = (conversationId: string) => {
    setContextMenu(null);
    setMoveMenu({ conversationId });
  };

  const handleMove = (conversationId: string, projectId: string | null) => {
    onMoveToProject(conversationId, projectId);
    setMoveMenu(null);
  };

  return (
    <>
      <aside className="w-[260px] h-full bg-surface border-r border-border flex flex-col relative animate-slide-in-left max-md:pt-12">
        {/* Header */}
        <div className="px-4 pb-3 pt-4 md:pt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shadow-soft">
                <span className="text-white font-bold text-sm">L</span>
              </div>
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
                  <div className="pl-12 pr-2">
                    {groupedByProject(project.id).length === 0 && (
                      <div className="text-[10px] text-text-dim py-1 italic">Belum ada percakapan</div>
                    )}
                    {groupedByProject(project.id).map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => onSelect(conv.id)}
                        onContextMenu={(e) => handleContextMenu(e, conv.id)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs truncate transition-colors btn-press ${
                          activeId === conv.id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-text-muted hover:text-text hover:bg-bg-alt'
                        }`}
                      >
                        {conv.title}
                      </button>
                    ))}
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

            <div className="px-2">
              {ungrouped.length === 0 && !search && (
                <div className="text-[10px] text-text-dim py-2 italic">Belum ada percakapan</div>
              )}
              {ungrouped.length === 0 && search && (
                <div className="text-[10px] text-text-dim py-2 italic">Tidak ditemukan</div>
              )}
              {ungrouped.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  onContextMenu={(e) => handleContextMenu(e, conv.id)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs truncate transition-colors btn-press ${
                    activeId === conv.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-text-muted hover:text-text hover:bg-bg-alt'
                  }`}
                >
                  {conv.title}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-soft">
              <span className="text-white font-bold text-xs">DA</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text truncate">Deni Arya</div>
              <div className="text-[10px] text-text-dim">AI Assistant • Free</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[200] bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[160px] animate-modal-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const conv = conversations.find(c => c.id === contextMenu.conversationId);
              if (conv) {
                // TODO: implement rename
                setContextMenu(null);
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors"
          >
            <Edit3 size={14} />
            Ganti nama
          </button>
          <button
            onClick={() => handleMoveClick(contextMenu.conversationId)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors"
          >
            <FolderInput size={14} />
            Pindah ke Proyek
          </button>
          <div className="mx-2 my-1 border-t border-border" />
          <button
            onClick={() => { onDelete(contextMenu.conversationId); setContextMenu(null); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
            Hapus
          </button>
        </div>
      )}

      {/* Move to Project Menu */}
      {moveMenu && (
        <div
          className="fixed z-[200] bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[180px] max-h-[200px] overflow-y-auto animate-modal-in"
          style={{
            left: contextMenu?.x || 100,
            top: contextMenu?.y || 100,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] text-text-dim font-medium uppercase">Pindahkan ke</div>
          <button
            onClick={() => handleMove(moveMenu.conversationId, null)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors"
          >
            <Clock size={14} />
            Riwayat
          </button>
          {projects.map(project => (
            <button
              key={project.id}
              onClick={() => handleMove(moveMenu.conversationId, project.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors"
            >
              <FolderOpen size={14} />
              {project.name}
            </button>
          ))}
          {projects.length === 0 && (
            <div className="px-3 py-2 text-xs text-text-dim italic">Buat proyek dulu di Pustaka</div>
          )}
        </div>
      )}
    </>
  );
}
