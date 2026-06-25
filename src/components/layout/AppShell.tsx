import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';
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
      {/* Desktop sidebar — spring animated width */}
      <motion.div
        animate={{ width: sidebarOpen ? 260 : 0, opacity: sidebarOpen ? 1 : 0, x: sidebarOpen ? 0 : -40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:block relative h-full z-10 overflow-hidden flex-shrink-0"
      >
        <div className="w-[260px] h-full">
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
      </motion.div>

      {/* Mobile sidebar — slide from left */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="fixed inset-y-0 left-0 z-50 md:hidden shadow-2xl"
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
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating sidebar toggle */}
      <AnimatePresence>
        {!sidebarOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => setSidebarOpen(true)}
            className="fixed top-3 left-3 z-30 p-2 rounded-xl bg-surface border border-border
              shadow-soft hover:bg-bg-alt text-text-muted hover:text-text btn-press"
          >
            <Menu size={18} />
          </motion.button>
        )}
      </AnimatePresence>

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
    </div>
  );
}
