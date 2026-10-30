import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Material, QuizAttempt } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../../store/useUIStore';
import { ai, aiErrorMsg } from '../../lib/ai';
import { QuizArraySchema, QuizQuestion } from '../../lib/schemas';
import {
  CheckSquare,
  Sparkles,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  History,
} from 'lucide-react';

export const QuizPage: React.FC = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { activeMaterialId, setActiveMaterialId, freeTopic, setFreeTopic, addToast } = useUIStore();

  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(
    profile?.default_difficulty || 'medium'
  );
  const [count, setCount] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active quiz session
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Fetch materials for selection
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

  // Fetch past quiz attempts
  const { data: pastQuizzes = [] } = useQuery<QuizAttempt[]>({
    queryKey: ['quiz_attempts', user?.id, 'quiz'],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('type', 'quiz')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Save quiz attempt mutation
  const saveAttemptMutation = useMutation({
    mutationFn: async (result: { score: number; total: number; questions: any[]; answers: any }) => {
      if (!user) return;
      const { topic } = getActiveText();
      const { error } = await supabase.from('quiz_attempts').insert({
        user_id: user.id,
        material_id: activeMaterialId || null,
        topic,
        type: 'quiz',
        difficulty,
        score: result.score,
        total: result.total,
        time_taken_sec: 0,
        questions: result.questions,
        answers: result.answers,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz_attempts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });

  const getActiveText = () => {
    if (activeMaterialId) {
      const mat = materials.find((m) => m.id === activeMaterialId);
      if (mat) return { topic: mat.title, content: mat.content || '' };
    }
    return { topic: freeTopic, content: '' };
  };

  const handleGenerate = async () => {
    const { topic, content } = getActiveText();
    if (!topic.trim()) {
      addToast('Enter a topic or select a study material first', false);
      return;
    }

    setLoading(true);
    setError(null);
    setQuizQuestions(null);
    setAnswers({});
    setIsSubmitted(false);

    const res = await ai.json<QuizQuestion[]>(
      'quiz',
      { topic, content, options: { count, difficulty } },
      QuizArraySchema
    );

    setLoading(false);
    if (res.error) {
      setError(aiErrorMsg(res.error));
      addToast(aiErrorMsg(res.error), false);
    } else if (res.data && res.data.length > 0) {
      setQuizQuestions(res.data);
      addToast(`Generated ${res.data.length} quiz questions!`);
    } else {
      setError('Could not generate quiz questions. Please try again.');
    }
  };

  const handleSubmit = () => {
    if (!quizQuestions) return;
    let score = 0;
    quizQuestions.forEach((q, i) => {
      if (answers[i] === q.correctAnswer) score++;
    });

    setIsSubmitted(true);
    saveAttemptMutation.mutate({
      score,
      total: quizQuestions.length,
      questions: quizQuestions,
      answers,
    });
    addToast(`Quiz submitted! You scored ${score}/${quizQuestions.length}`);
  };

  const resetQuiz = () => {
    setQuizQuestions(null);
    setAnswers({});
    setIsSubmitted(false);
  };

  // Render Taking Mode
  if (quizQuestions && !isSubmitted) {
    const answeredCount = Object.keys(answers).length;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Active Quiz</h1>
            <p className="text-xs text-muted">
              {answeredCount} of {quizQuestions.length} answered
            </p>
          </div>
          <button onClick={resetQuiz} className="btn-o text-xs py-1.5 px-3">
            Exit Quiz
          </button>
        </div>

        <div className="space-y-4">
          {quizQuestions.map((q, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="flex items-start gap-2">
                <span className="font-bold text-sm text-primary shrink-0">{i + 1}.</span>
                <p className="font-semibold text-sm text-foreground">{q.question}</p>
              </div>

              <div className="space-y-2 pl-5">
                {q.options.map((opt, j) => {
                  const checked = answers[i] === j;
                  return (
                    <label
                      key={j}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-sm cursor-pointer transition-all ${
                        checked
                          ? 'border-primary bg-indigo-50/50 dark:bg-indigo-950/20 font-medium'
                          : 'border-border hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${i}`}
                        checked={checked}
                        onChange={() => setAnswers({ ...answers, [i]: j })}
                        className="w-4 h-4 text-primary focus:ring-primary"
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            onClick={handleSubmit}
            disabled={answeredCount === 0}
            className="btn py-3 px-6 text-sm w-full sm:w-auto"
          >
            Submit Quiz
          </button>
        </div>
      </div>
    );
  }

  // Render Result Mode
  if (quizQuestions && isSubmitted) {
    let score = 0;
    quizQuestions.forEach((q, i) => {
      if (answers[i] === q.correctAnswer) score++;
    });
    const percentage = Math.round((score / quizQuestions.length) * 100);

    return (
      <div className="space-y-6">
        <div className="card p-6 text-center space-y-2 bg-gradient-to-b from-card to-zinc-50 dark:to-zinc-900/50">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Quiz Results</h1>
          <p className="text-3xl font-extrabold text-primary">{percentage}%</p>
          <p className="text-sm text-muted">
            You answered <span className="font-semibold text-foreground">{score}</span> out of{' '}
            <span className="font-semibold text-foreground">{quizQuestions.length}</span> questions correctly.
          </p>
          <div className="pt-2">
            <button onClick={resetQuiz} className="btn text-xs py-2 px-4">
              Take Another Quiz
            </button>
          </div>
        </div>

        {/* Detailed Question Review */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg">Detailed Review</h2>
          {quizQuestions.map((q, i) => {
            const isCorrect = answers[i] === q.correctAnswer;
            const chosenOption = answers[i] !== undefined ? q.options[answers[i]] : 'Not answered';
            const rightOption = q.options[q.correctAnswer];

            return (
              <div
                key={i}
                className={`card p-5 space-y-2 border-l-4 ${
                  isCorrect
                    ? 'border-l-emerald-500'
                    : 'border-l-red-500'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-sm text-muted">{i + 1}.</span>
                    <p className="font-semibold text-sm text-foreground">{q.question}</p>
                  </div>
                  {isCorrect ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-4 h-4" /> Correct
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 shrink-0">
                      <XCircle className="w-4 h-4" /> Incorrect
                    </span>
                  )}
                </div>

                <div className="text-xs space-y-1 pl-5">
                  <p>
                    <span className="text-muted">Your answer: </span>
                    <span className={isCorrect ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                      {chosenOption}
                    </span>
                  </p>
                  {!isCorrect && (
                    <p>
                      <span className="text-muted">Correct answer: </span>
                      <span className="text-emerald-600 font-medium">{rightOption}</span>
                    </p>
                  )}
                </div>

                {q.explanation && (
                  <div className="mt-2 pl-5 pt-2 border-t border-border text-xs text-muted flex items-start gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{q.explanation}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Render Quiz Setup Mode
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quiz Generator</h1>
        <p className="text-sm text-muted">Generate customized practice quizzes tailored to your notes or study topics.</p>
      </div>

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
              placeholder="Topic, e.g. 'Photosynthesis light reactions' or 'French irregular verbs'"
              value={freeTopic}
              onChange={(e) => setFreeTopic(e.target.value)}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
            >
              <option value="easy">Easy — Core foundational questions</option>
              <option value="medium">Medium — Standard testing level</option>
              <option value="hard">Hard — Challenging & application-based</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Number of Questions</label>
            <select
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10))}
            >
              <option value={5}>5 Questions (Quick Check)</option>
              <option value={10}>10 Questions (Standard Quiz)</option>
              <option value={20}>20 Questions (Comprehensive Review)</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="btn text-sm w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" /> Generating Quiz…
            </>
          ) : (
            <>
              <CheckSquare className="w-4 h-4" /> Generate Quiz
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="card p-4 border-red-300 dark:border-red-800 text-red-500 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={handleGenerate} className="btn-o text-xs py-1 px-2.5">
            <RotateCcw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Past Quiz Results */}
      {pastQuizzes.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <History className="w-4 h-4 text-muted" /> Recent Quiz Results
          </h2>
          <div className="grid gap-2">
            {pastQuizzes.map((q) => (
              <div
                key={q.id}
                className="card p-3.5 flex justify-between items-center text-sm"
              >
                <div>
                  <p className="font-semibold text-foreground">{q.topic}</p>
                  <p className="text-xs text-muted">
                    {q.difficulty} difficulty • {new Date(q.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-primary">
                    {q.score} / {q.total}
                  </span>
                  <span className="text-xs text-muted block">
                    {Math.round((q.score / q.total) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

