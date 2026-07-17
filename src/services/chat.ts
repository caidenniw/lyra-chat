import { supabase } from '../lib/supabase';
import type { Message, Conversation } from '../components/layout/AppShell';
import type { Project } from '../components/layout/Sidebar';

export interface DbConversation {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  files: any | null;
  created_at: string;
}

// Get all conversations for a user
export async function getConversations(userId: string): Promise<Conversation[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }

  return (data || []).map((conv: DbConversation) => ({
    id: conv.id,
    userId: conv.user_id,
    projectId: conv.project_id,
    title: conv.title,
    model: conv.model || 'mimo-v2.5-free',
    messages: [],
    createdAt: new Date(conv.created_at),
    updatedAt: new Date(conv.updated_at),
  }));
}

// Get all messages for a user (via their conversations)
export async function getMessages(userId: string): Promise<Message[]> {
  if (!supabase) return [];
  
  // First get conversation IDs for this user
  const { data: conversationData, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId);

  if (convError) {
    console.error('Error fetching conversation IDs:', convError);
    return [];
  }

  const conversationIds = (conversationData || []).map(c => c.id);
  
  if (conversationIds.length === 0) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, role, content, model, files, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  // Sort by created_at, then by role (user < assistant < system) for stable ordering
  const roleOrder: Record<string, number> = { user: 0, assistant: 1, system: 2 };
  const sorted = [...(data || [])].sort((a: DbMessage, b: DbMessage) => {
    const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
  });

  return sorted.map((msg: DbMessage) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    model: msg.model || undefined,
    files: msg.files || undefined,
    conversationId: msg.conversation_id,
    timestamp: new Date(msg.created_at),
  }));
}

// Create a new conversation
export async function createConversation(
  userId: string,
  conversation: Omit<Conversation, 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Conversation | null> {
  if (!supabase) return null;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      id: conversation.id,
      user_id: userId,
      project_id: conversation.projectId,
      title: conversation.title,
      model: conversation.model,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    projectId: data.project_id,
    title: data.title,
    model: data.model || 'mimo-v2.5-free',
    messages: [],
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

// Update conversation
export async function updateConversation(
  id: string,
  updates: Partial<Pick<Conversation, 'title' | 'projectId' | 'model'>>
): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('conversations')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating conversation:', error);
    return false;
  }

  return true;
}

// Delete conversation and its messages
export async function deleteConversation(id: string): Promise<boolean> {
  if (!supabase) return false;

  // Messages will be deleted automatically due to on delete CASCADE
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting conversation:', error);
    return false;
  }

  return true;
}

// Save a message
export async function saveMessage(
  conversationId: string,
  message: Omit<Message, 'conversationId'>
): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('messages')
    .insert({
      id: message.id,
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      model: message.model || null,
      files: message.files || null,
      created_at: message.timestamp.toISOString(),
    });

  if (error) {
    console.error('Error saving message:', error);
    return false;
  }

  // Update conversation updated_at
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return true;
}

// Save multiple messages
export async function saveMessages(
  conversationId: string,
  messages: Omit<Message, 'conversationId'>[]
): Promise<boolean> {
  if (!supabase || messages.length === 0) return false;

  const { error } = await supabase
    .from('messages')
    .insert(
      messages.map((message) => ({
        id: message.id,
        conversation_id: conversationId,
        role: message.role,
        content: message.content,
        model: message.model || null,
        files: message.files || null,
        created_at: message.timestamp.toISOString(),
      }))
    );

  if (error) {
    console.error('Error saving messages:', error);
    return false;
  }

  // Update conversation updated_at
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return true;
}

// Create a new project
export async function createProject(userId: string, name: string, type: string = 'general') {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name,
      type,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating project:', error);
    return null;
  }

  return data;
}

// Get projects for a user
export async function getProjects(userId: string): Promise<Project[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    return [];
  }

  return (data || []).map((project: any) => ({
    id: project.id,
    name: project.name,
    createdAt: new Date(project.created_at),
  }));
}

// Update project
export async function updateProject(id: string, updates: { name?: string; type?: string }) {
  if (!supabase) return false;

  const { error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating project:', error);
    return false;
  }

  return true;
}

// Export conversation as markdown
export function exportConversationAsMarkdown(conversation: Conversation): string {
  let md = `# ${conversation.title}\n\n`;
  md += `*Model: ${conversation.model}*\n`;
  md += `*Dibuat: ${conversation.createdAt.toLocaleString('id-ID')}*\n\n`;
  md += `---\n\n`;

  const convMessages = conversation.messages;
  for (const msg of convMessages) {
    const role = msg.role === 'user' ? '👤 Kamu' : msg.role === 'system' ? 'ℹ️ Sistem' : '🤖 Lyra';
    md += `### ${role}\n\n`;
    if (msg.content) {
      md += `${msg.content}\n\n`;
    }
    if (msg.model) {
      md += `*Model: ${msg.model}*\n\n`;
    }
  }

  md += `---\n*Diekspor dari Lyra v1.0.0*`;
  return md;
}

// Copy all messages in a conversation to clipboard
export function copyConversationToClipboard(conversation: Conversation): string {
  let text = `Percakapan: ${conversation.title}\n`;
  text += `${'='.repeat(40)}\n\n`;

  const convMessages = conversation.messages;
  for (const msg of convMessages) {
    const role = msg.role === 'user' ? 'Kamu' : msg.role === 'system' ? 'Sistem' : 'Lyra';
    text += `[${role}]\n${msg.content}\n\n`;
  }

  return text;
}

// Delete project
export async function deleteProject(id: string) {
  if (!supabase) return false;

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting project:', error);
    return false;
  }

  return true;
}
