import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Material, QuizAttempt } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../../store/useUIStore';
import { useMockRunStore } from '../../store/useMockRunStore';
import { ai, aiErrorMsg } from '../../lib/ai';
import { QuizArraySchema, QuizQuestion } from '../../lib/schemas';
import { fmtTime } from '../../lib/utils';
import {
  Timer,
  Sparkles,
  Bookmark,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Clock,
  History,
} from 'lucide-react';

export const MockPage: React.FC = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { activeMaterialId, setActiveMaterialId, freeTopic, setFreeTopic, addToast } = useUIStore();

  const mockRun = useMockRunStore();

  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(
    profile?.default_difficulty || 'medium'
  );
  const [count, setCount] = useState<number>(10);
  const [minutes, setMinutes] = useState<number>(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch past mock tests
  const { data: pastMocks = [] } = useQuery<QuizAttempt[]>({
    queryKey: ['quiz_attempts', user?.id, 'mock'],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('type', 'mock')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Save mock test attempt mutation
  const saveAttemptMutation = useMutation({
    mutationFn: async (result: {
      score: number;
      total: number;
      timeTaken: number;
      questions: any[];
      answers: any;
    }) => {
      if (!user) return;
      const { error } = await supabase.from('quiz_attempts').insert({
        user_id: user.id,
        material_id: activeMaterialId || null,
        topic: mockRun.topic,
        type: 'mock',
        difficulty: mockRun.difficulty,
        score: result.score,
        total: result.total,
        time_taken_sec: result.timeTaken,
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

  // Countdown timer hook (ticks every 1s when active)
  useEffect(() => {
    if (!mockRun.isActive || mockRun.isSubmitted) return;
    const interval = setInterval(() => {
      mockRun.decrementTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, [mockRun.isActive, mockRun.isSubmitted]);

  // Handle auto-submit or manual submit
  const handleFinalSubmit = () => {
    mockRun.submitMock();
    let score = 0;
    mockRun.questions.forEach((q, i) => {
      if (mockRun.answers[i] === q.correctAnswer) score++;
    });
    const timeTaken = mockRun.durationSec - mockRun.timeLeftSec;

    saveAttemptMutation.mutate({
      score,
      total: mockRun.questions.length,
      timeTaken,
      questions: mockRun.questions,
      answers: mockRun.answers,
    });
    addToast('Mock test submitted!');
  };

  const getActiveText = () => {
    if (activeMaterialId) {
      const mat = materials.find((m) => m.id === activeMaterialId);
      if (mat) return { topic: mat.title, content: mat.content || '' };
    }
    return { topic: freeTopic, content: '' };
  };

  const handleStartMock = async () => {
    const { topic, content } = getActiveText();
    if (!topic.trim()) {
      addToast('Enter a topic or select a study material first', false);
      return;
    }

    setLoading(true);
    setError(null);

    const res = await ai.json<QuizQuestion[]>(
      'mock',
      { topic, content, options: { count, difficulty } },
      QuizArraySchema
    );

    setLoading(false);
    if (res.error) {
      setError(aiErrorMsg(res.error));
      addToast(aiErrorMsg(res.error), false);
    } else if (res.data && res.data.length > 0) {
      mockRun.startMock({
        topic,
        difficulty,
        questions: res.data,
        minutes,
      });
      addToast(`Mock test started! ${res.data.length} questions, ${minutes} minutes.`);
    } else {
      setError('Could not generate mock test. Please try again.');
    }
  };

  // 1. ACTIVE TEST VIEW
  if (mockRun.isActive && !mockRun.isSubmitted && mockRun.questions.length > 0) {
    const currentQ = mockRun.questions[mockRun.currentIndex];
    const isMarked = mockRun.marked.includes(mockRun.currentIndex);

    return (
      <div className="space-y-6">
        {/* Header with Title and Countdown Timer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mock Exam</h1>
            <p className="text-xs text-muted">Topic: {mockRun.topic} ({mockRun.difficulty})</p>
          </div>
          <div
            className={`card px-4 py-2 font-mono text-lg font-bold flex items-center gap-2 self-start sm:self-auto ${
              mockRun.timeLeftSec < 120 ? 'text-red-500 border-red-500 animate-pulse' : 'text-primary'
            }`}
            aria-live="polite"
          >
            <Clock className="w-4 h-4" />
            <span>{fmtTime(mockRun.timeLeftSec)}</span>
          </div>
        </div>

        {/* Question Navigator Grid */}
        <div className="card p-4 space-y-2">
          <div className="flex justify-between items-center text-xs text-muted mb-1">
            <span>Question Navigator:</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-primary"></span> Answered
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-500"></span> Marked
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-zinc-200 dark:bg-zinc-700"></span> Unanswered
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5" role="navigation" aria-label="Questions list">
            {mockRun.questions.map((_, i) => {
              const isAnswered = mockRun.answers[i] !== undefined;
              const hasMark = mockRun.marked.includes(i);
              const isCurrent = i === mockRun.currentIndex;

              let btnStyle = 'bg-card text-foreground border border-border';
              if (isAnswered && hasMark) btnStyle = 'bg-amber-500 text-white border-amber-600';
              else if (isAnswered) btnStyle = 'bg-primary text-white border-primary';
              else if (hasMark) btnStyle = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-400';

              return (
                <button
                  key={i}
                  onClick={() => mockRun.goToIndex(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${btnStyle} ${
                    isCurrent ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-background' : ''
                  }`}
                  aria-label={`Go to question ${i + 1}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Question View */}
        <div className="card p-6 space-y-4">
          <div className="flex justify-between items-center text-xs text-muted">
            <span>
              Question {mockRun.currentIndex + 1} of {mockRun.questions.length}
            </span>
            {isMarked && (
              <span className="text-amber-500 font-semibold flex items-center gap-1">
                <Bookmark className="w-3.5 h-3.5 fill-amber-500" /> Marked for review
              </span>
            )}
          </div>

          <p className="font-semibold text-base text-foreground leading-relaxed">
            {currentQ.question}
          </p>

          <div className="space-y-2 pt-2">
            {currentQ.options.map((opt, j) => {
              const checked = mockRun.answers[mockRun.currentIndex] === j;
              return (
                <label
                  key={j}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm cursor-pointer transition-all ${
                    checked
                      ? 'border-primary bg-indigo-50/50 dark:bg-indigo-950/20 font-medium'
                      : 'border-border hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                  }`}
                >
                  <input
                    type="radio"
                    name={`mock-q-${mockRun.currentIndex}`}
                    checked={checked}
                    onChange={() => mockRun.setAnswer(mockRun.currentIndex, j)}
                    className="w-4 h-4 text-primary"
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-border">
            <div className="flex gap-2">
              <button
                onClick={() => mockRun.goToIndex(mockRun.currentIndex - 1)}
                disabled={mockRun.currentIndex === 0}
                className="btn-o text-xs py-1.5 px-3 flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                onClick={() => mockRun.goToIndex(mockRun.currentIndex + 1)}
                disabled={mockRun.currentIndex === mockRun.questions.length - 1}
                className="btn-o text-xs py-1.5 px-3 flex items-center gap-1"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => mockRun.toggleMark(mockRun.currentIndex)}
                className={`btn-o text-xs py-1.5 px-3 flex items-center gap-1.5 ${
                  isMarked ? 'bg-amber-500 text-white border-amber-600' : ''
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                {isMarked ? 'Unmark' : 'Mark for Review'}
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Are you ready to submit your mock test?')) {
                    handleFinalSubmit();
                  }
                }}
                className="btn text-xs py-1.5 px-4"
              >
                Submit Exam
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. RESULTS VIEW
  if (mockRun.isSubmitted && mockRun.questions.length > 0) {
    let score = 0;
    let unattempted = 0;

    mockRun.questions.forEach((q, i) => {
      if (mockRun.answers[i] === undefined) unattempted++;
      else if (mockRun.answers[i] === q.correctAnswer) score++;
    });

    const wrong = mockRun.questions.length - score - unattempted;
    const percentage = Math.round((score / mockRun.questions.length) * 100);
    const timeTaken = mockRun.durationSec - mockRun.timeLeftSec;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mock Test Results</h1>
          <p className="text-xs text-muted">Time taken: {fmtTime(timeTaken)} / {fmtTime(mockRun.durationSec)}</p>
        </div>

        {/* Score Grid Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4 text-center">
            <div className="text-2xl font-extrabold text-primary">{percentage}%</div>
            <div className="text-xs text-muted mt-0.5">Score</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{score}</div>
            <div className="text-xs text-muted mt-0.5">Correct</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-extrabold text-red-500">{wrong}</div>
            <div className="text-xs text-muted mt-0.5">Incorrect</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-extrabold text-zinc-400">{unattempted}</div>
            <div className="text-xs text-muted mt-0.5">Skipped</div>
          </div>
        </div>

        <button onClick={() => mockRun.resetMock()} className="btn text-xs py-2 px-4">
          Start New Mock Test
        </button>

        {/* Detailed Question Review */}
        <div className="space-y-3">
          <h2 className="font-bold text-lg">Question Breakdown</h2>
          {mockRun.questions.map((q, i) => {
            const ans = mockRun.answers[i];
            const isCorrect = ans === q.correctAnswer;
            const isSkipped = ans === undefined;

            return (
              <div
                key={i}
                className={`card p-5 space-y-2 border-l-4 ${
                  isSkipped
                    ? 'border-l-zinc-300 dark:border-l-zinc-700'
                    : isCorrect
                    ? 'border-l-emerald-500'
                    : 'border-l-red-500'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-sm text-muted">{i + 1}.</span>
                    <p className="font-semibold text-sm text-foreground">{q.question}</p>
                  </div>
                  {isSkipped ? (
                    <span className="text-xs font-medium text-zinc-400 shrink-0">Skipped</span>
                  ) : isCorrect ? (
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
                    <span className={isSkipped ? 'text-zinc-400' : isCorrect ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                      {isSkipped ? 'None' : q.options[ans]}
                    </span>
                  </p>
                  {!isCorrect && (
                    <p>
                      <span className="text-muted">Correct answer: </span>
                      <span className="text-emerald-600 font-medium">{q.options[q.correctAnswer]}</span>
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

  // 3. SETUP VIEW
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Timed Mock Tests</h1>
        <p className="text-sm text-muted">Simulate real examination conditions with countdown timers, mark-for-review, and instant grading.</p>
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
              placeholder="Topic, e.g. 'AP Biology Cellular Respiration' or 'Organic Chemistry Reactions'"
              value={freeTopic}
              onChange={(e) => setFreeTopic(e.target.value)}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Question Count</label>
            <select
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10))}
            >
              <option value={10}>10 Questions</option>
              <option value={20}>20 Questions</option>
              <option value={30}>30 Questions</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Time Limit</label>
            <select
              value={minutes}
              onChange={(e) => setMinutes(parseInt(e.target.value, 10))}
            >
              <option value={10}>10 Minutes</option>
              <option value={20}>20 Minutes</option>
              <option value={30}>30 Minutes</option>
              <option value={60}>60 Minutes (1 Hour)</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleStartMock}
          disabled={loading}
          className="btn text-sm w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" /> Preparing Exam…
            </>
          ) : (
            <>
              <Timer className="w-4 h-4" /> Start Mock Test
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
          <button onClick={handleStartMock} className="btn-o text-xs py-1 px-2.5">
            <RotateCcw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Past Mock Test Results */}
      {pastMocks.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <History className="w-4 h-4 text-muted" /> Recent Mock Test History
          </h2>
          <div className="grid gap-2">
            {pastMocks.map((q) => (
              <div
                key={q.id}
                className="card p-3.5 flex justify-between items-center text-sm"
              >
                <div>
                  <p className="font-semibold text-foreground">{q.topic}</p>
                  <p className="text-xs text-muted">
                    {q.difficulty} difficulty • Time: {fmtTime(q.time_taken_sec || 0)} •{' '}
                    {new Date(q.created_at).toLocaleDateString()}
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

