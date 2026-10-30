import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Material, FlashcardDeck } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../../store/useUIStore';
import { ai, aiErrorMsg } from '../../lib/ai';
import { FlashcardArraySchema, Flashcard } from '../../lib/schemas';
import {
  Layers,
  Sparkles,
  AlertCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Star,
  StarOff,
  Save,
  History,
  BookOpen,
} from 'lucide-react';

export const FlashcardsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { activeMaterialId, setActiveMaterialId, freeTopic, setFreeTopic, addToast } = useUIStore();

  const [count, setCount] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active flashcard session state
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [difficultIndexes, setDifficultIndexes] = useState<Set<number>>(new Set());
  const [reviewDifficultOnly, setReviewDifficultOnly] = useState(false);
  const [savedDeckId, setSavedDeckId] = useState<string | null>(null);

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

  // Fetch saved flashcard decks
  const { data: savedDecks = [] } = useQuery<FlashcardDeck[]>({
    queryKey: ['flashcard_decks', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('flashcard_decks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Save deck mutation
  const saveDeckMutation = useMutation({
    mutationFn: async () => {
      if (!user || !cards) throw new Error('No deck to save');
      const topic = getActiveText().topic;
      const { data, error } = await supabase
        .from('flashcard_decks')
        .insert({
          user_id: user.id,
          material_id: activeMaterialId || null,
          topic,
          cards,
          difficult_indexes: Array.from(difficultIndexes),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['flashcard_decks'] });
      setSavedDeckId(data.id);
      addToast('Flashcard deck saved!');
    },
    onError: (err: any) => {
      addToast(err.message || 'Could not save deck', false);
    },
  });

  // Update difficult marks mutation
  const updateDifficultMutation = useMutation({
    mutationFn: async (deckId: string) => {
      const { error } = await supabase
        .from('flashcard_decks')
        .update({ difficult_indexes: Array.from(difficultIndexes) })
        .eq('id', deckId);
      if (error) throw error;
    },
  });

  const getActiveText = () => {
    if (activeMaterialId) {
      const mat = materials.find((m) => m.id === activeMaterialId);
      if (mat) return { topic: mat.title, content: mat.content || '' };
    }
    return { topic: freeTopic, content: '' };
  };

  const displayedCards = reviewDifficultOnly && difficultIndexes.size > 0
    ? cards?.filter((_, i) => difficultIndexes.has(i)) || []
    : cards || [];

  const handleGenerate = async () => {
    const { topic, content } = getActiveText();
    if (!topic.trim()) {
      addToast('Enter a topic or select a study material first', false);
      return;
    }

    setLoading(true);
    setError(null);
    setCards(null);
    setSavedDeckId(null);
    setDifficultIndexes(new Set());
    setCurrentIndex(0);
    setIsFlipped(false);
    setReviewDifficultOnly(false);

    const res = await ai.json<Flashcard[]>(
      'flashcards',
      { topic, content, options: { count } },
      FlashcardArraySchema
    );

    setLoading(false);
    if (res.error) {
      setError(aiErrorMsg(res.error));
      addToast(aiErrorMsg(res.error), false);
    } else if (res.data && res.data.length > 0) {
      setCards(res.data);
      addToast(`Generated ${res.data.length} flashcards!`);
    } else {
      setError('Could not generate flashcards. Please try again.');
    }
  };

  const loadSavedDeck = (deck: FlashcardDeck) => {
    setCards(deck.cards);
    setDifficultIndexes(new Set(deck.difficult_indexes));
    setCurrentIndex(0);
    setIsFlipped(false);
    setReviewDifficultOnly(false);
    setSavedDeckId(deck.id);
    addToast(`Loaded deck: ${deck.topic}`);
  };

  const navigate = useCallback((dir: 'next' | 'prev') => {
    setIsFlipped(false);
    setCurrentIndex((prev) => {
      const total = displayedCards.length;
      if (dir === 'next') return (prev + 1) % total;
      return (prev - 1 + total) % total;
    });
  }, [displayedCards.length]);

  const handleShuffle = () => {
    if (!cards) return;
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setDifficultIndexes(new Set());
    addToast('Deck shuffled!');
  };

  const toggleDifficult = () => {
    setDifficultIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(currentIndex)) next.delete(currentIndex);
      else next.add(currentIndex);
      // Persist if deck is already saved
      if (savedDeckId) {
        updateDifficultMutation.mutate(savedDeckId);
      }
      return next;
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!cards) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') { e.preventDefault(); setIsFlipped((f) => !f); }
      if (e.code === 'ArrowRight') navigate('next');
      if (e.code === 'ArrowLeft') navigate('prev');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cards, navigate]);

  // ACTIVE FLASHCARD VIEW
  if (cards && displayedCards.length > 0) {
    const card = displayedCards[currentIndex];
    const isDifficult = difficultIndexes.has(currentIndex);
    const totalDifficult = difficultIndexes.size;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Flashcards</h1>
            <p className="text-xs text-muted mt-0.5">
              Card {currentIndex + 1} of {displayedCards.length}
              {reviewDifficultOnly && ` (Difficult only)`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {totalDifficult > 0 && (
              <button
                onClick={() => { setReviewDifficultOnly(!reviewDifficultOnly); setCurrentIndex(0); setIsFlipped(false); }}
                className={`btn-o text-xs py-1.5 px-3 flex items-center gap-1 ${reviewDifficultOnly ? '!bg-amber-500 !text-white !border-amber-600' : ''}`}
              >
                <Star className="w-3.5 h-3.5" />
                {reviewDifficultOnly ? `All Cards` : `Difficult (${totalDifficult})`}
              </button>
            )}
            <button
              onClick={() => { setCards(null); setSavedDeckId(null); }}
              className="btn-o text-xs py-1.5 px-3"
            >
              New Deck
            </button>
          </div>
        </div>

        {/* Card Flip Area */}
        <div
          role="button"
          tabIndex={0}
          aria-label={isFlipped ? 'Card is showing answer. Press Space to see question.' : 'Card is showing question. Press Space to flip and see answer.'}
          style={{ perspective: '1000px', height: '240px' }}
          className="cursor-pointer select-none"
          onClick={() => setIsFlipped((f) => !f)}
          onKeyDown={(e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); setIsFlipped((f) => !f); } }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              transition: 'transform 0.5s',
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front */}
            <div
              className="card absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Question</p>
              <p className="font-bold text-lg text-foreground leading-relaxed">{card.front}</p>
              <p className="text-xs text-muted mt-4 opacity-60">Press <kbd className="badge px-1.5">Space</kbd> or tap to flip</p>
            </div>
            {/* Back */}
            <div
              className="card absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-indigo-600/5 dark:bg-indigo-950/30 border-primary/30"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Answer</p>
              <p className="text-base text-foreground leading-relaxed">{card.back}</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => navigate('prev')} className="btn-o text-xs py-2 px-4 flex items-center gap-1" aria-label="Previous card">
            <ChevronLeft className="w-4 h-4" /> Prev <kbd className="badge px-1 text-[9px]">←</kbd>
          </button>
          <button
            onClick={toggleDifficult}
            className={`btn-o text-xs py-2 px-4 flex items-center gap-1.5 ${isDifficult ? '!bg-amber-500 !text-white !border-amber-600' : ''}`}
          >
            {isDifficult ? <StarOff className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
            {isDifficult ? 'Unmark' : 'Mark Difficult'}
          </button>
          <button onClick={handleShuffle} className="btn-o text-xs py-2 px-4 flex items-center gap-1.5">
            <Shuffle className="w-3.5 h-3.5" /> Shuffle
          </button>
          <button onClick={() => navigate('next')} className="btn-o text-xs py-2 px-4 flex items-center gap-1" aria-label="Next card">
            Next <kbd className="badge px-1 text-[9px]">→</kbd> <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Save deck button */}
        {!savedDeckId && (
          <div className="text-center">
            <button
              onClick={() => saveDeckMutation.mutate()}
              disabled={saveDeckMutation.isPending}
              className="btn text-xs py-2 px-4 flex items-center gap-1.5 mx-auto"
            >
              <Save className="w-3.5 h-3.5" />
              {saveDeckMutation.isPending ? 'Saving…' : 'Save Deck to Library'}
            </button>
          </div>
        )}
        {savedDeckId && <p className="text-center text-xs text-emerald-500 font-medium">✓ Deck saved to your library</p>}

        {/* Keyboard shortcuts hint */}
        <p className="text-center text-xs text-muted opacity-60">
          Keyboard shortcuts: <kbd className="badge px-1.5">Space</kbd> flip • <kbd className="badge px-1.5">←</kbd><kbd className="badge px-1.5">→</kbd> navigate
        </p>
      </div>
    );
  }

  // SETUP VIEW
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Flashcards</h1>
        <p className="text-sm text-muted">Generate study flashcards from your materials or any topic. Mark difficult cards and review them separately.</p>
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
              placeholder="Topic, e.g. 'French irregular verbs' or 'Python data structures'"
              value={freeTopic}
              onChange={(e) => setFreeTopic(e.target.value)}
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Number of Cards</label>
          <select value={count} onChange={(e) => setCount(parseInt(e.target.value, 10))}>
            <option value={10}>10 Cards</option>
            <option value={15}>15 Cards</option>
            <option value={20}>20 Cards</option>
          </select>
        </div>

        <button onClick={handleGenerate} disabled={loading} className="btn text-sm w-full sm:w-auto">
          {loading ? (
            <><Sparkles className="w-4 h-4 animate-spin" /> Generating Flashcards…</>
          ) : (
            <><Layers className="w-4 h-4" /> Generate Flashcards</>
          )}
        </button>
      </div>

      {error && (
        <div className="card p-4 border-red-300 dark:border-red-800 text-red-500 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={handleGenerate} className="btn-o text-xs py-1 px-2.5"><RotateCcw className="w-3 h-3" /> Retry</button>
        </div>
      )}

      {/* Saved Decks */}
      {savedDecks.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <History className="w-4 h-4 text-muted" /> Saved Decks
          </h2>
          <div className="grid gap-2">
            {savedDecks.map((deck) => (
              <div key={deck.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-foreground">{deck.topic}</p>
                  <p className="text-xs text-muted">
                    {deck.cards.length} cards
                    {deck.difficult_indexes?.length > 0 && ` • ${deck.difficult_indexes.length} marked difficult`}
                    {' '}• {new Date(deck.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => loadSavedDeck(deck)} className="btn text-xs py-1.5 px-3 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> Study
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

