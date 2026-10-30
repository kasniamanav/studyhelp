import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, Material } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../../store/useUIStore';
import { ai, aiErrorMsg } from '../../lib/ai';
import { ExplainSchema, ExplainData } from '../../lib/schemas';
import {
  Lightbulb,
  Sparkles,
  BookOpen,
  Send,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  RotateCcw,
  GraduationCap,
} from 'lucide-react';

export const ExplainerPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { activeMaterialId, setActiveMaterialId, freeTopic, setFreeTopic, addToast } = useUIStore();

  const [level, setLevel] = useState<'beginner' | 'simple' | 'detailed' | 'exam'>(
    profile?.default_explain_level || 'simple'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explainData, setExplainData] = useState<ExplainData | null>(null);

  // Follow-up chat state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [followupInput, setFollowupInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Fetch materials for dropdown
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

  const getActiveText = () => {
    if (activeMaterialId) {
      const mat = materials.find((m) => m.id === activeMaterialId);
      if (mat) return { topic: mat.title, content: mat.content || '' };
    }
    return { topic: freeTopic, content: '' };
  };

  const handleExplain = async () => {
    const { topic, content } = getActiveText();
    if (!topic.trim()) {
      addToast('Enter a topic or select a study material first', false);
      return;
    }

    setLoading(true);
    setError(null);
    setExplainData(null);

    const res = await ai.json<ExplainData>(
      'explain',
      { topic, content, options: { level } },
      ExplainSchema
    );

    setLoading(false);
    if (res.error) {
      setError(aiErrorMsg(res.error));
      addToast(aiErrorMsg(res.error), false);
    } else if (res.data) {
      setExplainData(res.data);
      setChatMessages([
        {
          role: 'assistant',
          content: `I've prepared an explanation of "${topic}". Ask me any follow-up questions, request deeper examples, or ask for clarifications!`,
        },
      ]);
      addToast('Explanation generated!');
    }
  };

  const handleAskFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followupInput.trim() || chatLoading) return;

    const userQ = followupInput.trim();
    setFollowupInput('');
    const newHistory = [...chatMessages, { role: 'user' as const, content: userQ }];
    setChatMessages(newHistory);
    setChatLoading(true);

    const { topic, content } = getActiveText();
    const res = await ai.chat(newHistory, { topic, content });

    setChatLoading(false);
    if (res.error) {
      setChatMessages([
        ...newHistory,
        { role: 'assistant', content: aiErrorMsg(res.error) },
      ]);
    } else if (res.data) {
      setChatMessages([
        ...newHistory,
        { role: 'assistant', content: res.data },
      ]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Explainer</h1>
        <p className="text-sm text-muted">Break down complex concepts into clear, structured, and exam-ready explanations.</p>
      </div>

      {/* Control Card */}
      <div className="card p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Study Material or Topic</label>
          <select
            value={activeMaterialId || ''}
            onChange={(e) => setActiveMaterialId(e.target.value || null)}
            className="mb-2"
          >
            <option value="">— Free Topic (Type your own) —</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} {m.subject ? `(${m.subject})` : ''}
              </option>
            ))}
          </select>

          {!activeMaterialId && (
            <input
              placeholder="Enter a topic, e.g. 'What is the citric acid cycle?' or 'Quantum superposition'"
              value={freeTopic}
              onChange={(e) => setFreeTopic(e.target.value)}
            />
          )}
        </div>

        {/* Level Selector */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Explanation Depth</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'beginner', label: 'Beginner', desc: 'Simple analogies' },
              { id: 'simple', label: 'Simple', desc: 'Clear & concise' },
              { id: 'detailed', label: 'Detailed', desc: 'In-depth & rigorous' },
              { id: 'exam', label: 'Exam Focus', desc: 'Mark schemes & high-yield' },
            ].map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => setLevel(lvl.id as any)}
                className={`btn-o text-xs py-1.5 px-3 rounded-lg flex flex-col items-start ${
                  level === lvl.id ? '!bg-primary !text-white !border-primary' : ''
                }`}
              >
                <span className="font-semibold">{lvl.label}</span>
                <span className={`text-[10px] ${level === lvl.id ? 'text-indigo-100' : 'text-muted'}`}>
                  {lvl.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleExplain}
          disabled={loading}
          className="btn text-sm w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" /> Generating Explanation…
            </>
          ) : (
            <>
              <Lightbulb className="w-4 h-4" /> Explain Concept
            </>
          )}
        </button>
      </div>

      {/* Error Card */}
      {error && (
        <div className="card p-4 border-red-300 dark:border-red-800 text-red-500 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={handleExplain} className="btn-o text-xs py-1 px-2.5">
            <RotateCcw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Structured Output */}
      {explainData && (
        <div className="space-y-4">
          <div className="card p-6 space-y-5">
            {/* Overview */}
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2 text-foreground mb-2">
                <GraduationCap className="w-5 h-5 text-primary" /> Concept Overview
              </h2>
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                {explainData.overview}
              </p>
            </div>

            {/* Key Points */}
            {explainData.keyPoints?.length > 0 && (
              <div className="border-t border-border pt-4">
                <h3 className="font-semibold text-sm mb-2 text-foreground flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> Key Points
                </h3>
                <ul className="list-disc pl-5 text-sm space-y-1.5 text-foreground/80">
                  {explainData.keyPoints.map((kp, i) => (
                    <li key={i}>{kp}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Definitions */}
            {explainData.definitions?.length > 0 && (
              <div className="border-t border-border pt-4">
                <h3 className="font-semibold text-sm mb-2 text-foreground flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-500" /> Key Definitions & Terminology
                </h3>
                <div className="grid gap-2 text-sm">
                  {explainData.definitions.map((def, i) => (
                    <div key={i} className="card p-2.5 bg-zinc-50 dark:bg-zinc-900/40">
                      <span className="font-semibold text-primary">{def.term}: </span>
                      <span className="text-foreground/90">{def.definition}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Examples */}
            {explainData.examples?.length > 0 && (
              <div className="border-t border-border pt-4">
                <h3 className="font-semibold text-sm mb-2 text-foreground flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-500" /> Real-World Examples & Analogies
                </h3>
                <ul className="list-disc pl-5 text-sm space-y-1.5 text-foreground/80">
                  {explainData.examples.map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Common Mistakes & Exam Tips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4">
              {explainData.commonMistakes?.length > 0 && (
                <div className="card p-3.5 bg-red-500/5 border-red-200 dark:border-red-900/30">
                  <h4 className="font-semibold text-xs text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Common Pitfalls to Avoid
                  </h4>
                  <ul className="list-disc pl-4 text-xs space-y-1 text-foreground/80">
                    {explainData.commonMistakes.map((cm, i) => (
                      <li key={i}>{cm}</li>
                    ))}
                  </ul>
                </div>
              )}

              {explainData.examTips?.length > 0 && (
                <div className="card p-3.5 bg-amber-500/5 border-amber-200 dark:border-amber-900/30">
                  <h4 className="font-semibold text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Exam Scoring Tips
                  </h4>
                  <ul className="list-disc pl-4 text-xs space-y-1 text-foreground/80">
                    {explainData.examTips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Quick Revision Checklist */}
            {explainData.quickRevision?.length > 0 && (
              <div className="border-t border-border pt-4">
                <h3 className="font-semibold text-xs uppercase tracking-wider text-muted mb-2">
                  Quick Revision Checklist
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {explainData.quickRevision.map((rev, i) => (
                    <span key={i} className="badge px-2.5 py-1 text-xs">
                      ✓ {rev}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Follow-up Interactive Chat */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary" /> Ask Follow-Up Questions
            </h3>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-white ml-8 rounded-br-none'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-foreground mr-8 rounded-bl-none'
                  }`}
                >
                  <p className="font-semibold text-[11px] mb-0.5 opacity-80">
                    {msg.role === 'user' ? 'You' : 'StudyAI Tutor'}
                  </p>
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>
              ))}
              {chatLoading && (
                <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl mr-8 text-sm text-muted flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-primary" /> Tutor is thinking…
                </div>
              )}
            </div>

            <form onSubmit={handleAskFollowup} className="flex gap-2 pt-2">
              <input
                value={followupInput}
                onChange={(e) => setFollowupInput(e.target.value)}
                placeholder="e.g. Can you give me an example with numbers?"
                disabled={chatLoading}
              />
              <button
                type="submit"
                disabled={chatLoading || !followupInput.trim()}
                className="btn py-2 px-4 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

