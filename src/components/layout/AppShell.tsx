import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AuthModal } from '../auth/AuthModal';
import { Sidebar, type Project } from './Sidebar';
import { ChatArea } from '../chat/ChatArea';
import { InputArea } from '../chat/InputArea';
import { EmptyState } from '../chat/EmptyState';
import { useChat } from '../../hooks/useChat';
import {
  getConversations,
  getMessages,
  getProjects,
  createConversation as createConversationDb,
  updateConversation as updateConversationDb,
  deleteConversation as deleteConversationDb,
  createProject as createProjectDb,
} from '../../services/chat';

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
  userId?: string;
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('mimo-v2.5-free');
  const [isLoading, setIsLoading] = useState(false);

  const { sendMessage, isStreaming, streamingMessageId, messages, setMessages } = useChat({
    model: selectedModel,
    userId: user?.id,
    onModelChange: setSelectedModel,
  });

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeMessages = useMemo(
    () => messages.filter(m => m.conversationId === activeConversationId),
    [messages, activeConversationId]
  );

  // Load conversations, messages, and projects from Supabase when user changes
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        // Guest mode: reset to empty
        setConversations([]);
        setMessages([]);
        setProjects([]);
        setActiveConversationId(null);
        return;
      }

      setIsLoading(true);
      try {
        const [dbConversations, dbMessages, dbProjects] = await Promise.all([
          getConversations(user.id),
          getMessages(user.id),
          getProjects(user.id),
        ]);

        setConversations(dbConversations);
        setMessages(dbMessages);
        setProjects(dbProjects as Project[]);

        // Set active conversation to the most recent one if exists
        if (dbConversations.length > 0) {
          setActiveConversationId(dbConversations[0].id);
        } else {
          // No existing conversations: create a new one automatically
          const defaultConv: Conversation = {
            id: crypto.randomUUID(),
            title: 'Chat baru',
            messages: [],
            model: selectedModel,
            projectId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          if (user) {
            const saved = await createConversationDb(user.id, defaultConv);
            if (saved) {
              setConversations([saved]);
              setActiveConversationId(saved.id);
            } else {
              setConversations([defaultConv]);
              setActiveConversationId(defaultConv.id);
            }
          } else {
            setConversations([defaultConv]);
            setActiveConversationId(defaultConv.id);
          }
        }
      } catch (error) {
        console.error('Error loading chat data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.id]); // Only reload when user ID changes (not object reference)

  // Update selected model when active conversation changes
  useEffect(() => {
    if (activeConversation?.model) {
      setSelectedModel(activeConversation.model);
    }
  }, [activeConversationId]);

  const handleNewChat = async (): Promise<Conversation> => {
    const newConv: Conversation = {
      id: crypto.randomUUID(),
      title: 'Chat baru',
      messages: [],
      model: selectedModel,
      projectId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // If user is logged in, save to Supabase
    if (user) {
      const saved = await createConversationDb(user.id, newConv);
      if (saved) {
        setConversations(prev => [saved, ...prev]);
        setActiveConversationId(saved.id);
        return saved;
      }
    }

    // Guest mode or save failed: use local state
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    return newConv;
  };

  const handleSendMessage = async (content: string, files?: AttachedFile[]) => {
    let currentConversationId = activeConversationId;
    let currentConversation = activeConversation;

    // Create a new conversation if none is active
    if (!currentConversationId || !currentConversation) {
      const newConv = await handleNewChat();
      currentConversationId = newConv.id;
      currentConversation = newConv;
    }

    const hasExistingMessages = messages.some(m => m.conversationId === currentConversationId && m.role === 'user');
    if (!hasExistingMessages) {
      const title = content.length > 40 ? content.substring(0, 40) + '...' : content;
      setConversations(prev =>
        prev.map(c => (c.id === currentConversationId ? { ...c, title } : c))
      );

      // Update title in Supabase if logged in
      if (user) {
        updateConversationDb(currentConversationId, { title }).catch(console.error);
      }
    }

    sendMessage(content, files, currentConversationId);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    // Auto-close sidebar on mobile after selection
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    if (user) {
      await deleteConversationDb(id);
    }

    const remaining = conversations.filter(c => c.id !== id);
    setConversations(remaining);

    if (activeConversationId === id) {
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        // No conversations left: create a new one
        await handleNewChat();
      }
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));

    if (user) {
      await updateConversationDb(id, { title: newTitle });
    }
  };

  const handleCreateProject = async (name: string) => {
    if (user) {
      const saved = await createProjectDb(user.id, name);
      if (saved) {
        const newProject: Project = {
          id: saved.id,
          name: saved.name,
          createdAt: new Date(saved.created_at),
        };
        setProjects(prev => [...prev, newProject]);
        return;
      }
    }

    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date(),
    };
    setProjects(prev => [...prev, newProject]);
  };

  const handleMoveToProject = async (conversationId: string, projectId: string | null) => {
    setConversations(prev =>
      prev.map(c => c.id === conversationId ? { ...c, projectId } : c)
    );

    if (user) {
      await updateConversationDb(conversationId, { projectId });
    }
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
            onRename={handleRenameConversation}
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
                onRename={handleRenameConversation}
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
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-text-muted">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-sm">Memuat percakapan...</span>
            </div>
          </div>
        ) : hasMessages ? (
          <ChatArea messages={activeMessages} streamingMessageId={streamingMessageId} />
        ) : (
          <EmptyState onSend={(content: string) => handleSendMessage(content)} user={user} />
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
