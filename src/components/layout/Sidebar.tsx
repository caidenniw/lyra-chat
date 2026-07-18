import { Search, Plus, FolderOpen, Clock, Trash2, Edit3, FolderInput, ChevronRight, ChevronDown, PanelLeftClose, LogOut, MoreVertical, Check, X, User as UserIcon, Download, Pin, PinOff } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import logoIcon from "../../assets/gambar2.png";
import { Portal } from "../ui/Portal";

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
  allMessages?: Array<{ conversationId?: string; content: string }>;
  projects: Project[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onNewChat: () => void;
  onCreateProject: (name: string) => void;
  onMoveToProject: (conversationId: string, projectId: string | null) => void;
  onExportChat?: (id: string) => void;
  onShowPrivacy?: () => void;
  pinnedConversations?: Set<string>;
  onTogglePin?: (id: string) => void;
}

export function Sidebar({ onToggle, user, onAuthModalOpen, onSignOut, conversations, allMessages, projects, activeId, onSelect, onDelete, onRename, onNewChat, onCreateProject, onMoveToProject, onExportChat, onShowPrivacy, pinnedConversations, onTogglePin }: SidebarProps) {
  const [search, setSearch] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    projects.forEach(p => { init[p.id] = true; });
    return init;
  });
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [moveMenu, setMoveMenu] = useState<string | null>(null);
  const [menuFlipUp, setMenuFlipUp] = useState<Set<string>>(new Set());
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const newProjectRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (showNewProject && newProjectRef.current) newProjectRef.current.focus();
  }, [showNewProject]);

  useEffect(() => {
    if (renameId && renameInputRef.current) renameInputRef.current.focus();
  }, [renameId]);

  // Close menus on outside click — only when click is outside BOTH trigger and menu
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const activeId = activeMenu || moveMenu;
      if (!activeId) return;
      const triggerEl = menuButtonRefs.current[activeId];
      const menuEl = menuContainerRefs.current[activeId];
      const isOutsideTrigger = !triggerEl || !triggerEl.contains(target);
      const isOutsideMenu = !menuEl || !menuEl.contains(target);
      if (isOutsideTrigger && isOutsideMenu) {
        setActiveMenu(null);
        setMoveMenu(null);
      }
    };
    if (activeMenu || moveMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [activeMenu, moveMenu]);

  // Keyboard navigation: Escape, ArrowUp, ArrowDown, Home, End
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const activeId = activeMenu || moveMenu;
      if (!activeId) {
        if (e.key === "Escape") {
          setShowNewProject(false);
          setRenameId(null);
        }
        return;
      }

      const menuEl = menuContainerRefs.current[activeId];
      if (!menuEl) return;

      const items = Array.from(menuEl.querySelectorAll<HTMLElement>('[role="menuitem"], button:not([disabled])'));
      const currentIndex = items.findIndex((item) => item === document.activeElement);

      if (e.key === "Escape") {
        e.preventDefault();
        setActiveMenu(null);
        setMoveMenu(null);
        lastTriggerRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = currentIndex >= 0 ? (currentIndex + 1) % items.length : 0;
        items[next]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = currentIndex >= 0 ? (currentIndex - 1 + items.length) % items.length : items.length - 1;
        items[prev]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        items[items.length - 1]?.focus();
      } else if (e.key === "Tab" && !e.shiftKey && currentIndex === items.length - 1) {
        // Tab from last item: close menu, return focus to trigger, allow natural tab flow
        e.preventDefault();
        setActiveMenu(null);
        setMoveMenu(null);
        lastTriggerRef.current?.focus();
      } else if (e.key === "Tab" && e.shiftKey && currentIndex === 0) {
        e.preventDefault();
        setActiveMenu(null);
        setMoveMenu(null);
        lastTriggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [activeMenu, moveMenu]);

  const filteredConversations = search
    ? conversations.filter((c) => {
        // Search by title
        if (c.title.toLowerCase().includes(search.toLowerCase())) return true;
        // Search by message content
        if (allMessages && allMessages.length > 0) {
          const convMessages = allMessages.filter(m => m.conversationId === c.id);
          return convMessages.some(m => m.content.toLowerCase().includes(search.toLowerCase()));
        }
        return false;
      })
    : conversations;

  // Sort: pinned conversations first
  const sortFn = (a: { id: string }, b: { id: string }) => {
    const aPinned = pinnedConversations?.has(a.id) ? 0 : 1;
    const bPinned = pinnedConversations?.has(b.id) ? 0 : 1;
    return aPinned - bPinned;
  };
  const sortedConversations = [...filteredConversations].sort(sortFn);

  const ungrouped = sortedConversations.filter((c) => !c.projectId);
  const groupedByProject = (projectId: string) => sortedConversations.filter((c) => c.projectId === projectId);

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName("");
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
    setRenameValue("");
  };

  const handleMenuToggle = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (activeMenu === convId) {
      setActiveMenu(null);
      setMoveMenu(null);
      setMenuPos(null);
      setMenuFlipUp(prev => {
        const next = new Set(prev);
        next.delete(convId);
        return next;
      });
    } else {
      lastTriggerRef.current = menuButtonRefs.current[convId] || null;
      setActiveMenu(convId);
      setMoveMenu(null);
      setMenuPos(null);
      // Compute fixed position and flip
      requestAnimationFrame(() => {
        const triggerEl = menuButtonRefs.current[convId];
        const navEl = navRef.current;
        if (triggerEl) {
          const rect = triggerEl.getBoundingClientRect();
          const menuWidth = 180;
          const menuHeight = 220;
          const navRect = navEl?.getBoundingClientRect();
          const spaceBelow = navRect ? navRect.bottom - rect.bottom : window.innerHeight - rect.bottom;
          const spaceAbove = navRect ? rect.top - navRect.top : rect.top;
          const shouldFlipUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;
          setMenuFlipUp(prev => {
            const next = new Set(prev);
            if (shouldFlipUp) next.add(convId);
            else next.delete(convId);
            return next;
          });
          const x = Math.max(8, rect.right - menuWidth);
          const y = shouldFlipUp ? rect.top - menuHeight : rect.bottom + 4;
          setMenuPos({ x, y });
        }
      });
    }
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
                if (e.key === "Enter") confirmRename();
                if (e.key === "Escape") {
                  setRenameId(null);
                  setRenameValue("");
                }
              }}
              onBlur={confirmRename}
              className="flex-1 px-2 py-1 text-sm bg-bg border border-primary/30 rounded-lg outline-none"
            />
            <button onClick={confirmRename} className="p-0.5 text-primary hover:text-primary-light">
              <Check size={14} />
            </button>
            <button
              onClick={() => {
                setRenameId(null);
                setRenameValue("");
              }}
              className="p-0.5 text-text-dim hover:text-text"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          /* Normal chat item - div instead of button to avoid nested buttons */
          <div
            onClick={() => onSelect(conv.id)}
            className={`w-full flex items-center gap-1 pr-1 text-left rounded-lg text-sm transition-colors cursor-pointer ${
              activeId === conv.id ? "bg-primary/10 text-primary font-medium py-1.5 px-3" : "text-text-muted hover:text-text hover:bg-bg-alt py-1.5 px-3"
            }`}
          >
            <span className="flex-1 truncate">{conv.title}</span>
            {pinnedConversations?.has(conv.id) && <Pin size={10} className="text-primary/60 shrink-0" />}
            {/* Three-dot menu button — always visible on mobile, hover on desktop */}
            <button
              ref={(el) => {
                menuButtonRefs.current[conv.id] = el;
              }}
              onClick={(e) => handleMenuToggle(e, conv.id)}
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              aria-controls={`conversation-menu-${conv.id}`}
              aria-label="Tindakan percakapan"
              className={`p-0.5 rounded text-text-dim hover:text-text hover:bg-border/50 transition-colors ${isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 max-md:opacity-100"}`}
            >
              <MoreVertical size={12} />
            </button>
          </div>
        )}

        {/* Dropdown menu via Portal */}
        <AnimatePresence>
          {isMenuOpen && !isMoveOpen && menuPos && (
            <Portal>
              <motion.div
                ref={(el) => { menuContainerRefs.current[conv.id] = el; }}
                initial={{ opacity: 0, scale: 0.95, y: menuFlipUp.has(conv.id) ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: menuFlipUp.has(conv.id) ? 4 : -4 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                role="menu"
                id={`conversation-menu-${conv.id}`}
                aria-label="Tindakan percakapan"
                style={{ position: "fixed", left: menuPos.x, top: menuPos.y }}
                className="z-[100] bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[160px]"
              >
                <button role="menuitem" onClick={() => startRename(conv.id, conv.title)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors">
                  <Edit3 size={14} />
                  Ganti nama
                </button>
                <button role="menuitem" onClick={() => handleMoveClick(conv.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors">
                  <FolderInput size={14} />
                  Pindah ke Proyek
                </button>
                {onExportChat && (
                  <button role="menuitem" onClick={() => { onExportChat(conv.id); setActiveMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors">
                    <Download size={14} />
                    Export .md
                  </button>
                )}
                {onTogglePin && (
                  <button role="menuitem" onClick={() => { onTogglePin(conv.id); setActiveMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors">
                    {pinnedConversations?.has(conv.id) ? <PinOff size={14} className="text-primary" /> : <Pin size={14} />}
                    {pinnedConversations?.has(conv.id) ? 'Lepas pin' : 'Pin'}
                  </button>
                )}
                <div className="mx-2 my-1 border-t border-border" />
                <button
                  role="menuitem"
                  onClick={() => {
                    onDelete(conv.id);
                    setActiveMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                  Hapus
                </button>
              </motion.div>
            </Portal>
          )}
        </AnimatePresence>

        {/* Move to Project sub-menu via Portal */}
        <AnimatePresence>
          {isMoveOpen && menuPos && (
            <Portal>
              <motion.div
                ref={(el) => { menuContainerRefs.current[`move-${conv.id}`] = el; }}
                initial={{ opacity: 0, scale: 0.95, y: menuFlipUp.has(conv.id) ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: menuFlipUp.has(conv.id) ? 4 : -4 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                role="menu"
                id={`move-menu-${conv.id}`}
                aria-label="Pindahkan ke proyek"
                style={{ position: "fixed", left: menuPos.x, top: menuPos.y }}
                className="z-[100] bg-surface border border-border rounded-xl shadow-lg py-1 min-w-[180px] max-h-[200px] overflow-y-auto"
              >
                <div className="px-3 py-1.5 text-[10px] text-text-dim font-medium uppercase">Pindahkan ke</div>
                <button role="menuitem" onClick={() => handleMove(conv.id, null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors">
                  <Clock size={14} />
                  Riwayat
                </button>
                {projects.map((project) => (
                  <button role="menuitem" key={project.id} onClick={() => handleMove(conv.id, project.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-bg-alt transition-colors">
                    <FolderOpen size={14} />
                    {project.name}
                  </button>
                ))}
                {projects.length === 0 && <div className="px-3 py-2 text-xs text-text-dim italic">Buat proyek dulu di Pustaka</div>}
                <div className="mx-2 my-1 border-t border-border" />
                <button role="menuitem" onClick={() => setMoveMenu(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-dim hover:bg-bg-alt transition-colors">
                  ← Kembali
                </button>
              </motion.div>
            </Portal>
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
            <a href="/" className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <img src={logoIcon} alt="Lyra" className="w-8 h-8 rounded-xl object-contain" />
              <span className="font-semibold text-text text-base">Lyra</span>
            </a>
            <button onClick={onToggle} className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-alt transition-colors btn-press" title="Tutup sidebar">
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
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text text-xs btn-press">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav ref={navRef} className="px-3 mb-2 overflow-y-auto flex-1">
          {/* Pustaka */}
          <div>
            {/* FIX: Changed outer button to div to avoid nested button nesting */}
            <div
              onClick={() => {
                const allExpanded = projects.every((p) => expandedProjects[p.id]);
                if (allExpanded) {
                  setExpandedProjects({});
                } else {
                  const next: Record<string, boolean> = {};
                  projects.forEach((p) => {
                    next[p.id] = true;
                  });
                  setExpandedProjects(next);
                }
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm text-text-muted hover:text-text hover:bg-bg-alt transition-colors cursor-pointer btn-press"
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
                {projects.length > 0 && (projects.every((p) => expandedProjects[p.id]) ? <ChevronDown size={14} className="text-text-dim" /> : <ChevronRight size={14} className="text-text-dim" />)}
              </div>
            </div>

            {/* New Project Input */}
            {showNewProject && (
              <div className="px-3 py-2">
                <input
                  ref={newProjectRef}
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateProject();
                    if (e.key === "Escape") {
                      setShowNewProject(false);
                      setNewProjectName("");
                    }
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
            {projects.map((project) => (
              <div key={project.id}>
                <button onClick={() => toggleProject(project.id)} className="w-full flex items-center justify-between pl-9 pr-3 py-1.5 rounded-lg text-sm text-text-muted hover:text-text hover:bg-bg-alt transition-colors btn-press">
                  <span className="truncate">{project.name}</span>
                  <span className="text-[10px] text-text-dim bg-bg-alt px-1.5 py-0.5 rounded-md">{groupedByProject(project.id).length}</span>
                </button>

                {/* Conversations in project */}
                {expandedProjects[project.id] && (
                  <div className="pl-6 pr-1">
                    {groupedByProject(project.id).length === 0 && <div className="text-[10px] text-text-dim py-1 italic">Belum ada percakapan</div>}
                    {groupedByProject(project.id).map((conv) => renderConvItem(conv))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Riwayat */}
          <div className="mt-1">
            {/* FIX: Changed button to div — it's just a label, not interactive */}
            <div className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-text-muted hover:text-text hover:bg-bg-alt transition-colors cursor-pointer btn-press">
              <Clock size={16} />
              <span className="font-medium">Riwayat</span>
            </div>

            <div className="px-1">
              {ungrouped.length === 0 && !search && <div className="text-[10px] text-text-dim py-2 italic">Belum ada percakapan</div>}
              {ungrouped.length === 0 && search && <div className="text-[10px] text-text-dim py-2 italic">Tidak ditemukan</div>}
              {ungrouped.map((conv) => renderConvItem(conv))}
            </div>
          </div>
        </nav>

        {/* Developer badge */}
        <div className="px-4 pb-2 space-y-1">
          <a href="https://github.com/caidenniw" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-alt/50 hover:bg-bg-alt transition-colors group">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-text-dim group-hover:text-text transition-colors">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span className="text-[11px] text-text-dim group-hover:text-text-muted transition-colors">Lyra v1.1.0</span>
            <span className="text-[10px] text-text-dim/50 ml-auto">by Caiden</span>
          </a>
          {onShowPrivacy && (
            <button onClick={onShowPrivacy} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] text-text-dim hover:text-text hover:bg-bg-alt transition-colors">
              Kebijakan Privasi
            </button>
          )}
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-border">
          {user ? (
            <div className="flex items-center gap-3 px-1 py-1.5 rounded-xl hover:bg-bg-alt transition-colors">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-soft flex-shrink-0">
                <span className="text-white font-bold text-xs">{user.email?.charAt(0).toUpperCase() || "U"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">{user.email}</div>
              </div>
              <button onClick={onSignOut} className="p-1.5 rounded-lg text-text-dim hover:text-accent-maroon hover:bg-red-50 transition-colors btn-press flex-shrink-0" title="Keluar">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button onClick={onAuthModalOpen} className="w-full flex items-center gap-3 px-1 py-1.5 rounded-xl hover:bg-bg-alt transition-colors btn-press text-left">
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
