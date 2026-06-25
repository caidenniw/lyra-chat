import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AuthModal } from '../auth/AuthModal';
import { Sidebar, type Project } from './Sidebar';
import { ChatArea } from '../chat/ChatArea';
import { InputArea } from '../chat/InputArea';
import { EmptyState } from '../chat/EmptyState';
import { useChat } from '../../hooks/useChat';

export interface AttachedFile {
  name: string;
  type: string;
  size: number;
  preview: string;
  content?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  files?: AttachedFile[];
  model?: string;
  conversationId?: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  projectId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: '1',
      title: 'Chat baru',
      messages: [],
      model: 'deepseek-v4-flash-free',
      projectId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>('1');
  const [selectedModel, setSelectedModel] = useState('deepseek-v4-flash-free');

  const { sendMessage, isStreaming, streamingMessageId, messages } = useChat({ model: selectedModel, onModelChange: setSelectedModel });

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeMessages = messages.filter(m => m.conversationId === activeConversationId);

  const handleNewChat = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: 'Chat baru',
      messages: [],
      model: selectedModel,
      projectId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
  };

  const handleSendMessage = (content: string, files?: AttachedFile[]) => {
    if (!activeConversation || !activeConversationId) return;

    const hasExistingMessages = messages.some(m => m.conversationId === activeConversationId && m.role === 'user');
    if (!hasExistingMessages) {
      const title = content.length > 40 ? content.substring(0, 40) + '...' : content;
      setConversations(prev =>
        prev.map(c => (c.id === activeConversationId ? { ...c, title } : c))
      );
    }

    sendMessage(content, files, activeConversationId);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    // Auto-close sidebar on mobile after selection
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(conversations.find(c => c.id !== id)?.id || null);
    }
  };

  const handleCreateProject = (name: string) => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date(),
    };
    setProjects(prev => [...prev, newProject]);
  };



  const handleMoveToProject = (conversationId: string, projectId: string | null) => {
    setConversations(prev =>
      prev.map(c => c.id === conversationId ? { ...c, projectId } : c)
    );
  };

  const hasMessages = activeMessages.length > 0;

  return (
    <div className="h-[100dvh] flex overflow-hidden bg-bg">
      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* Sidebar — fixed overlay on mobile, static on desktop */}
      <div 
        className={`
        max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50
        max-md:transition-transform max-md:duration-300 max-md:ease-[cubic-bezier(0.16,1,0.3,1)]
        ${sidebarOpen ? 'max-md:translate-x-0 shadow-2xl' : 'max-md:-translate-x-full'}
        
        md:relative md:h-full md:transition-all md:duration-300 md:ease-[cubic-bezier(0.16,1,0.3,1)]
        ${sidebarOpen ? 'md:w-[260px] md:translate-x-0 md:opacity-100' : 'md:w-0 md:-translate-x-10 md:opacity-0 md:overflow-hidden'}
      `}
      >
        <Sidebar
          onToggle={() => setSidebarOpen(false)}
          user={user}
          onAuthModalOpen={() => setAuthModalOpen(true)}
          onSignOut={signOut}
          conversations={conversations}
          projects={projects}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
          onNewChat={handleNewChat}
          onCreateProject={handleCreateProject}

          onMoveToProject={handleMoveToProject}
        />
      </div>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Floating sidebar toggle — visible when sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-3 left-3 z-30 p-2 rounded-xl bg-surface border border-border
            shadow-soft hover:bg-bg-alt text-text-muted hover:text-text btn-press animate-fade-in"
        >
          <Menu size={18} />
        </button>
      )}

      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {hasMessages ? (
          <ChatArea messages={activeMessages} streamingMessageId={streamingMessageId} />
        ) : (
          <EmptyState onSend={(content: string) => handleSendMessage(content)} />
        )}
        <InputArea
          onSend={handleSendMessage}
          hasMessages={!!hasMessages}
          isStreaming={isStreaming}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </main>

      {/* Guest Banner — compact pill */}
      {!user && !guestBannerDismissed && (
        <div className="fixed bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-full shadow-medium text-xs animate-fade-in">
          <span className="text-text-muted">Chat tidak tersimpan</span>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="px-2.5 py-1 rounded-full bg-primary text-white hover:bg-primary-hover font-medium transition-colors btn-press"
          >
            Login
          </button>
          <button
            onClick={() => setGuestBannerDismissed(true)}
            className="p-0.5 rounded-full text-text-dim hover:text-text hover:bg-bg-alt transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
