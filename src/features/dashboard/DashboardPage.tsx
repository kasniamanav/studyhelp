import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase, Material, QuizAttempt } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../../store/useUIStore';
import {
  FileText,
  CheckSquare,
  Award,
  PlusCircle,
  Timer,
  Layers,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { setActiveMaterialId } = useUIStore();

  // Load user materials
  const { data: materials = [], isLoading: loadingMats } = useQuery<Material[]>({
    queryKey: ['materials', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Load user quiz & mock attempts
  const { data: quizAttempts = [], isLoading: loadingAttempts } = useQuery<QuizAttempt[]>({
    queryKey: ['quiz_attempts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Calculate stats
  const totalMaterials = materials.length;
  const totalAttempts = quizAttempts.length;
  const avgScore = totalAttempts > 0
    ? Math.round(
        quizAttempts.reduce((acc, q) => acc + (q.total > 0 ? (q.score / q.total) * 100 : 0), 0) /
          totalAttempts
      )
    : 0;

  // Recent 5 materials
  const recentMaterials = materials.slice(0, 5);

  // Score over time chart data
  const chartData = quizAttempts.slice(-10).map((attempt, index) => ({
    name: `Test ${index + 1}`,
    topic: attempt.topic,
    date: new Date(attempt.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
    score: attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0,
  }));

  // Identify weak topics (any attempts with score < 70%)
  const weakTopicsMap: Record<string, { totalScore: number; count: number; lastScore: number }> = {};
  quizAttempts.forEach((q) => {
    const pct = q.total > 0 ? (q.score / q.total) * 100 : 0;
    if (!weakTopicsMap[q.topic]) {
      weakTopicsMap[q.topic] = { totalScore: 0, count: 0, lastScore: pct };
    }
    weakTopicsMap[q.topic].totalScore += pct;
    weakTopicsMap[q.topic].count += 1;
    weakTopicsMap[q.topic].lastScore = pct;
  });

  const weakTopics = Object.entries(weakTopicsMap)
    .map(([topic, data]) => ({
      topic,
      avg: Math.round(data.totalScore / data.count),
      lastScore: Math.round(data.lastScore),
      count: data.count,
    }))
    .filter((t) => t.avg < 75)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Welcome back, {profile?.display_name || user?.email?.split('@')[0] || 'Student'} 👋
        </h1>
        <p className="text-sm text-muted mt-1">Your AI-powered study companion.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-foreground">
              {loadingMats ? '…' : totalMaterials}
            </div>
            <div className="text-xs text-muted font-medium mt-0.5">Study Materials</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-foreground">
              {loadingAttempts ? '…' : totalAttempts}
            </div>
            <div className="text-xs text-muted font-medium mt-0.5">Quizzes / Tests Taken</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
            <CheckSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl md:text-3xl font-extrabold text-foreground">
              {loadingAttempts ? '…' : `${avgScore}%`}
            </div>
            <div className="text-xs text-muted font-medium mt-0.5">Average Score</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          className="btn text-xs py-2 px-3.5"
          onClick={() => navigate('/materials')}
        >
          <PlusCircle className="w-4 h-4" /> Add study material
        </button>
        <button
          className="btn-o text-xs py-2 px-3.5"
          onClick={() => navigate('/quiz')}
        >
          <CheckSquare className="w-4 h-4 text-indigo-500" /> Generate quiz
        </button>
        <button
          className="btn-o text-xs py-2 px-3.5"
          onClick={() => navigate('/mock')}
        >
          <Timer className="w-4 h-4 text-amber-500" /> Mock test
        </button>
        <button
          className="btn-o text-xs py-2 px-3.5"
          onClick={() => navigate('/flashcards')}
        >
          <Layers className="w-4 h-4 text-emerald-500" /> Flashcards
        </button>
      </div>

      {/* Chart & Weak Topics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Over Time Chart */}
        <div className="card p-5 lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Performance History
            </h2>
            <span className="text-xs text-muted">Recent attempts</span>
          </div>

          {chartData.length > 0 ? (
            <div className="w-full h-56 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--bd)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`${val}%`, 'Score']}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--pri)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: 'var(--pri)' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-center text-muted text-xs">
              <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
              <p>No test data recorded yet.</p>
              <p className="mt-1">Take a quiz or mock test to see your score trajectory!</p>
            </div>
          )}
        </div>

        {/* Weak Topics / Areas for Review */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Focus Topics
          </h2>
          <p className="text-xs text-muted">
            Topics where your scores indicate extra review could boost grades.
          </p>

          {weakTopics.length > 0 ? (
            <div className="space-y-2 pt-1">
              {weakTopics.map((item, idx) => (
                <div
                  key={idx}
                  className="card p-2.5 flex items-center justify-between text-xs bg-amber-500/5 border-amber-200 dark:border-amber-900/30"
                >
                  <div className="overflow-hidden pr-2">
                    <p className="font-semibold truncate text-foreground">{item.topic}</p>
                    <span className="text-[10px] text-muted">Average: {item.avg}%</span>
                  </div>
                  <button
                    onClick={() => {
                      navigate('/explainer');
                    }}
                    className="btn-o text-[10px] py-1 px-2 shrink-0"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-36 flex flex-col items-center justify-center text-center text-muted text-xs">
              <BookOpen className="w-7 h-7 mb-1.5 opacity-30 text-emerald-500" />
              <p>No weak topics flagged!</p>
              <p className="text-[11px] mt-0.5">Keep up the great study streak.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Materials */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Recent materials</h2>
          <button
            onClick={() => navigate('/materials')}
            className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
          >
            View all ({materials.length}) <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentMaterials.length > 0 ? (
          <div className="grid gap-2">
            {recentMaterials.map((m) => (
              <div
                key={m.id}
                className="card p-3.5 flex justify-between items-center transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                <div>
                  <div className="font-medium text-sm text-foreground">{m.title}</div>
                  <div className="text-xs text-muted flex items-center gap-2 mt-0.5">
                    {m.subject && <span className="text-primary font-medium">{m.subject}</span>}
                    {m.topic && <span>• {m.topic}</span>}
                    <span>• {new Date(m.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-o text-xs py-1 px-3"
                    onClick={() => {
                      setActiveMaterialId(m.id);
                      navigate('/explainer');
                    }}
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center text-sm text-muted">
            <p>No materials yet — add your lecture notes or textbooks to get started.</p>
            <button
              onClick={() => navigate('/materials')}
              className="btn text-xs py-2 px-4 mt-3 inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Material
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
