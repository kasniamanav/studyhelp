import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Material, ChatThread, ChatMessage } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../../store/useUIStore';
import { ai, aiErrorMsg } from '../../lib/ai';
import {
  Plus,
  Send,
  Trash2,
  Edit2,
  Check,
  X,
  BookOpen,
  CheckSquare,
  Layers,
  Sparkles,
  Bot,
  User as UserIcon,
} from 'lucide-react';

export const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { activeMaterialId, setActiveMaterialId, setFreeTopic, addToast } = useUIStore();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch materials for grounding
  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ['materials', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('materials').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch user's chat threads
  const { data: threads = [] } = useQuery<ChatThread[]>({
    queryKey: ['chat_threads', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('chat_threads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Select first thread if none active
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0].id);
    }
  }, [threads, activeThreadId]);

  // Fetch messages for active thread
  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ['chat_messages', activeThreadId],
    queryFn: async () => {
      if (!activeThreadId) return [];
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', activeThreadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeThreadId,
  });

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Create new thread mutation
  const createThreadMutation = useMutation({
    mutationFn: async (title: string = 'New Conversation') => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('chat_threads')
        .insert({
          user_id: user.id,
          material_id: activeMaterialId || null,
          title,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (newThread) => {
      queryClient.invalidateQueries({ queryKey: ['chat_threads'] });
      if (newThread) setActiveThreadId(newThread.id);
    },
  });

  // Rename thread mutation
  const renameThreadMutation = useMutation({
    mutationFn: async ({ threadId, title }: { threadId: string; title: string }) => {
      const { error } = await supabase
        .from('chat_threads')
        .update({ title })
        .eq('id', threadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_threads'] });
      setEditingThreadId(null);
      addToast('Thread renamed');
    },
  });

  // Delete thread mutation
  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase.from('chat_threads').delete().eq('id', threadId);
      if (error) throw error;
      return threadId;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['chat_threads'] });
      if (activeThreadId === deletedId) {
        setActiveThreadId(null);
      }
      addToast('Conversation deleted');
    },
  });

  // Send message handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !user) return;

    let targetThreadId = activeThreadId;

    // Create thread if none exists
    if (!targetThreadId) {
      const newThread = await createThreadMutation.mutateAsync(
        input.slice(0, 30) + (input.length > 30 ? '…' : '')
      );
      if (!newThread) return;
      targetThreadId = newThread.id;
    }

    const userMessageContent = input.trim();
    setInput('');
    setSending(true);

    try {
      // 1. Insert user message into Supabase
      const { error: userMsgErr } = await supabase.from('chat_messages').insert({
        thread_id: targetThreadId,
        user_id: user.id,
        role: 'user',
        content: userMessageContent,
      });
      if (userMsgErr) throw userMsgErr;

      queryClient.invalidateQueries({ queryKey: ['chat_messages', targetThreadId] });

      // Grounding material context
      let topic = '';
      let content = '';
      if (activeMaterialId) {
        const mat = materials.find((m) => m.id === activeMaterialId);
        if (mat) {
          topic = mat.title;
          content = mat.content;
        }
      }

      // 2. Call AI chat
      const chatHistory = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userMessageContent },
      ];

      const res = await ai.chat(chatHistory, { topic, content });

      const assistantReply = res.data || aiErrorMsg(res.error);

      // 3. Insert assistant reply into Supabase
      await supabase.from('chat_messages').insert({
        thread_id: targetThreadId,
        user_id: user.id,
        role: 'assistant',
        content: assistantReply,
      });

      queryClient.invalidateQueries({ queryKey: ['chat_messages', targetThreadId] });
    } catch (err: any) {
      addToast(err.message || 'Error sending message', false);
    } finally {
      setSending(false);
    }
  };

  const handleTurnIntoQuiz = (content: string) => {
    setFreeTopic(content.slice(0, 80));
    navigate('/quiz');
    addToast('Grounded quiz in this answer!');
  };

  const handleTurnIntoFlashcards = (content: string) => {
    setFreeTopic(content.slice(0, 80));
    navigate('/flashcards');
    addToast('Grounded flashcards in this answer!');
  };

  const activeMaterial = materials.find((m) => m.id === activeMaterialId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Study Assistant</h1>
          <p className="text-xs text-muted">Chat with an expert tutor grounded in your study materials.</p>
        </div>

        {/* Grounding material selector */}
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary shrink-0" />
          <select
            value={activeMaterialId || ''}
            onChange={(e) => setActiveMaterialId(e.target.value || null)}
            className="text-xs py-1.5 w-full sm:w-64"
          >
            <option value="">— General Tutor (No Material) —</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                Grounded in: {m.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[calc(100vh-14rem)] min-h-[500px]">
        {/* Threads Sidebar */}
        <div className="card p-3 md:col-span-1 flex flex-col h-full">
          <button
            onClick={() => createThreadMutation.mutate('New Chat')}
            className="btn text-xs py-2 w-full mb-3 flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New Conversation
          </button>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {threads.map((t) => {
              const isActive = t.id === activeThreadId;
              const isEditing = t.id === editingThreadId;

              return (
                <div
                  key={t.id}
                  onClick={() => !isEditing && setActiveThreadId(t.id)}
                  className={`group flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all ${
                    isActive
                      ? 'bg-primary text-white font-medium'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted hover:text-foreground'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                      <input
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="py-0.5 px-1.5 text-xs text-foreground bg-card"
                        autoFocus
                      />
                      <button
                        onClick={() => renameThreadMutation.mutate({ threadId: t.id, title: editedTitle })}
                        className="p-1 hover:text-emerald-400"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingThreadId(null)} className="p-1 hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="truncate flex-1 pr-2">{t.title}</span>
                      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingThreadId(t.id);
                            setEditedTitle(t.title);
                          }}
                          className="p-1 opacity-70 hover:opacity-100"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this conversation?')) {
                              deleteThreadMutation.mutate(t.id);
                            }
                          }}
                          className="p-1 opacity-70 hover:opacity-100 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {threads.length === 0 && (
              <p className="text-center text-xs text-muted py-6">No conversations yet.</p>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="card p-4 md:col-span-3 flex flex-col h-full">
          {/* Active context header badge */}
          {activeMaterial && (
            <div className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-primary border border-indigo-200 dark:border-indigo-900/50 px-3 py-1.5 rounded-lg mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>
                Grounded in <strong>{activeMaterial.title}</strong> — Tutor will reference these notes in answers.
              </span>
            </div>
          )}

          {/* Messages scroll box */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted p-6">
                <Bot className="w-12 h-12 mb-3 text-primary opacity-40" />
                <h3 className="font-semibold text-base text-foreground">How can I help you study today?</h3>
                <p className="text-xs max-w-sm mt-1">
                  Ask me to summarize complex topics, break down formulas, give exam tips, or quiz your memory.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed space-y-2 ${
                        isUser
                          ? 'bg-primary text-white rounded-tr-none'
                          : 'card bg-card border-border rounded-tl-none shadow-sm'
                      }`}
                    >
                      <p className="whitespace-pre-line text-xs md:text-sm">{m.content}</p>

                      {/* Convert Answer Shortcuts (for assistant replies) */}
                      {!isUser && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50 text-[11px]">
                          <span className="text-muted text-[10px]">Action shortcuts:</span>
                          <button
                            onClick={() => handleTurnIntoQuiz(m.content)}
                            className="btn-o text-[10px] py-0.5 px-2 flex items-center gap-1"
                          >
                            <CheckSquare className="w-3 h-3 text-indigo-500" /> Turn into Quiz
                          </button>
                          <button
                            onClick={() => handleTurnIntoFlashcards(m.content)}
                            className="btn-o text-[10px] py-0.5 px-2 flex items-center gap-1"
                          >
                            <Layers className="w-3 h-3 text-emerald-500" /> Flashcards
                          </button>
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-foreground flex items-center justify-center shrink-0 mt-0.5">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {sending && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="card p-3 rounded-2xl rounded-tl-none text-xs text-muted flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-primary" /> StudyAI is thinking…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input form */}
          <form onSubmit={handleSendMessage} className="flex gap-2 pt-3 border-t border-border mt-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your study material..."
              disabled={sending}
              className="text-sm"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="btn py-2 px-4 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
