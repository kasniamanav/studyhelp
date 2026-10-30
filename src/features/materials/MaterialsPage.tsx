import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Material } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../../store/useUIStore';
import { parseFile } from '../../lib/fileParsers';
import {
  FileText,
  Upload,
  Trash2,
  Lightbulb,
  CheckSquare,
  Layers,
  Search,
  BookOpen,
  MessageSquare,
  Presentation,
  Loader2,
} from 'lucide-react';

export const MaterialsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setActiveMaterialId, addToast } = useUIStore();

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [fileParsing, setFileParsing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Load user's materials with offline/demo resilience
  const { data: materials = [], isLoading } = useQuery<Material[]>({
    queryKey: ['materials', user?.id],
    queryFn: async () => {
      if (!user) return [];
      try {
        const { data, error } = await supabase
          .from('materials')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) {
          const local: Material[] = JSON.parse(localStorage.getItem('studyai_local_materials') || '[]');
          // Merge Supabase materials with any local session materials
          const ids = new Set(data.map((m) => m.id));
          const uniqueLocal = local.filter((m) => !ids.has(m.id));
          return [...data, ...uniqueLocal];
        }
      } catch (_) {
        // Fallback
      }
      return JSON.parse(localStorage.getItem('studyai_local_materials') || '[]');
    },
    enabled: !!user,
  });

  // Save / Add Material mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) {
        throw new Error('Please give your material a title');
      }
      if (!user) throw new Error('You must be logged in');

      let sourceFilePath: string | undefined = undefined;

      // Upload file to Supabase storage if file was provided
      if (selectedFile) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const filePath = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('materials')
            .upload(filePath, selectedFile);
          if (!uploadError) {
            sourceFilePath = filePath;
          }
        } catch (_) {
          // Soft failure for storage
        }
      }

      try {
        const { data, error } = await supabase
          .from('materials')
          .insert({
            user_id: user.id,
            title: title.trim(),
            subject: subject.trim(),
            topic: topic.trim(),
            content: content.trim(),
            source_file_path: sourceFilePath,
          })
          .select()
          .single();

        if (!error && data) return data;
      } catch (_) {
        // Fallback to local session storage
      }

      // Local storage fallback
      const localMat: Material = {
        id: 'local-' + Date.now(),
        user_id: user.id,
        title: title.trim(),
        subject: subject.trim(),
        topic: topic.trim(),
        content: content.trim(),
        source_file_path: sourceFilePath,
        created_at: new Date().toISOString(),
      };
      const existing: Material[] = JSON.parse(localStorage.getItem('studyai_local_materials') || '[]');
      localStorage.setItem('studyai_local_materials', JSON.stringify([localMat, ...existing]));
      return localMat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setTitle('');
      setSubject('');
      setTopic('');
      setContent('');
      setSelectedFile(null);
      addToast('Study material saved successfully!');
    },
    onError: (err: any) => {
      addToast(err.message || 'Could not save material', false);
    },
  });

  // Delete Material mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        await supabase.from('materials').delete().eq('id', id);
      } catch (_) {}
      const existing: Material[] = JSON.parse(localStorage.getItem('studyai_local_materials') || '[]');
      localStorage.setItem(
        'studyai_local_materials',
        JSON.stringify(existing.filter((m) => m.id !== id))
      );
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setActiveMaterialId(null);
      addToast('Material deleted');
    },
    onError: (err: any) => {
      addToast(err.message || 'Could not delete', false);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileParsing(true);
    try {
      const result = await parseFile(file);
      setSelectedFile(file);
      setContent(result.text);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      addToast(`Extracted ${result.text.length} characters from ${file.name}`);
    } catch (err: any) {
      addToast(err.message, false);
    } finally {
      setFileParsing(false);
    }
  };

  const filteredMaterials = materials.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.subject && m.subject.toLowerCase().includes(search.toLowerCase())) ||
      (m.topic && m.topic.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Study Materials</h1>
        <p className="text-sm text-muted">Upload, organize, and study from your textbooks, lecture notes, or slides.</p>
      </div>

      {/* Upload & Add Form */}
      <div className="card p-5">
        <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" /> Add New Material
        </h2>
        <div className="grid gap-3">
          <input
            placeholder="Title (e.g. Photosynthesis and Calvin Cycle)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Subject (e.g. Biology, AP US History)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <input
              placeholder="Chapter / Topic (e.g. Cell Energy)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <textarea
            rows={5}
            placeholder="Paste your notes or document text here (or upload a file below to auto-extract text)..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label className="btn-o text-xs cursor-pointer flex items-center gap-1.5 hover:border-primary">
                {fileParsing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{fileParsing ? 'Extracting text…' : 'Upload file (.txt, .pdf, .docx, .pptx)'}</span>
                <input
                  type="file"
                  accept=".txt,.pdf,.docx,.pptx"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={fileParsing}
                />
              </label>
              {selectedFile && (
                <span className="text-xs text-muted truncate max-w-[200px]">
                  {selectedFile.name}
                </span>
              )}
            </div>

            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !title.trim() || fileParsing}
              className="btn text-sm w-full sm:w-auto"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Material'}
            </button>
          </div>
        </div>
      </div>

      {/* Materials List Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            Your Materials ({materials.length})
          </h2>
          {materials.length > 0 && (
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search materials…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 py-1.5 text-xs"
              />
              <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-2.5" />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <div className="card p-4 h-24 animate-pulse bg-zinc-100 dark:bg-zinc-800" />
            <div className="card p-4 h-24 animate-pulse bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="card p-8 text-center text-muted">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No study materials found.</p>
            <p className="text-xs mt-1">Add your notes above or upload a document to get started.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredMaterials.map((m) => (
              <div key={m.id} className="card p-4 transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-semibold text-base text-foreground">{m.title}</h3>
                    <div className="text-xs text-muted flex items-center gap-2 mt-0.5">
                      {m.subject && <span className="font-medium text-primary">{m.subject}</span>}
                      {m.topic && <span>• {m.topic}</span>}
                      <span>• {new Date(m.created_at).toLocaleDateString()}</span>
                      {m.content && <span>• {m.content.length.toLocaleString()} chars</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this material?')) {
                        deleteMutation.mutate(m.id);
                      }
                    }}
                    className="p-1.5 text-muted hover:text-red-500 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    title="Delete material"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {m.content && (
                  <p className="text-xs text-muted mt-2 line-clamp-2">
                    {m.content}
                  </p>
                )}

                {/* Quick actions for this material */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                  <button
                    onClick={() => {
                      setActiveMaterialId(m.id);
                      navigate('/explainer');
                    }}
                    className="btn-o text-xs py-1 px-2.5 flex items-center gap-1.5"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Explain
                  </button>
                  <button
                    onClick={() => {
                      setActiveMaterialId(m.id);
                      navigate('/quiz');
                    }}
                    className="btn-o text-xs py-1 px-2.5 flex items-center gap-1.5"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-500" /> Quiz Me
                  </button>
                  <button
                    onClick={() => {
                      setActiveMaterialId(m.id);
                      navigate('/flashcards');
                    }}
                    className="btn-o text-xs py-1 px-2.5 flex items-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-500" /> Flashcards
                  </button>
                  <button
                    onClick={() => {
                      setActiveMaterialId(m.id);
                      navigate('/presentation');
                    }}
                    className="btn-o text-xs py-1 px-2.5 flex items-center gap-1.5"
                  >
                    <Presentation className="w-3.5 h-3.5 text-purple-500" /> Slides
                  </button>
                  <button
                    onClick={() => {
                      setActiveMaterialId(m.id);
                      navigate('/chat');
                    }}
                    className="btn-o text-xs py-1 px-2.5 flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-blue-500" /> Chat
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

