import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Material, PresentationRecord } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../../store/useUIStore';
import { ai, aiErrorMsg } from '../../lib/ai';
import { PresentationSchema, PresentationData, Slide } from '../../lib/schemas';
import pptxgen from 'pptxgenjs';
import { jsPDF } from 'jspdf';
import {
  Presentation,
  Sparkles,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  FileSpreadsheet,
  FileDown,
  History,
  MessageSquare,
} from 'lucide-react';

export const PresentationPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { activeMaterialId, setActiveMaterialId, freeTopic, setFreeTopic, addToast } = useUIStore();

  const [slideCount, setSlideCount] = useState<number>(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active presentation state
  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

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

  // Fetch saved presentations
  const { data: savedPresentations = [] } = useQuery<PresentationRecord[]>({
    queryKey: ['presentations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('presentations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Save presentation mutation
  const savePresMutation = useMutation({
    mutationFn: async (data: PresentationData) => {
      if (!user) return;
      const { topic } = getActiveText();
      const { error } = await supabase.from('presentations').insert({
        user_id: user.id,
        material_id: activeMaterialId || null,
        topic: topic || data.title,
        slides: data,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presentations'] });
      addToast('Presentation saved to your library!');
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
    setPresentation(null);
    setCurrentSlideIndex(0);

    const res = await ai.json<PresentationData>(
      'presentation',
      { topic, content, options: { slideCount } },
      PresentationSchema
    );

    setLoading(false);
    if (res.error) {
      setError(aiErrorMsg(res.error));
      addToast(aiErrorMsg(res.error), false);
    } else if (res.data) {
      setPresentation(res.data);
      savePresMutation.mutate(res.data);
      addToast(`Generated ${res.data.slides.length} slides!`);
    } else {
      setError('Could not generate slide deck. Please try again.');
    }
  };

  // Fullscreen keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!presentation) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => Math.min(presentation.slides.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentation, isFullscreen]);

  // Export to PPTX
  const exportToPptx = async () => {
    if (!presentation) return;
    try {
      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_16x9';

      // Title Slide
      const titleSlide = pptx.addSlide();
      titleSlide.background = { color: 'F7F7FB' };
      titleSlide.addText(presentation.title, {
        x: 1,
        y: 2,
        w: '85%',
        fontSize: 32,
        bold: true,
        color: '1E1B2E',
      });
      if (presentation.subtitle) {
        titleSlide.addText(presentation.subtitle, {
          x: 1,
          y: 3.5,
          w: '85%',
          fontSize: 18,
          color: '6B7280',
        });
      }

      // Content Slides
      presentation.slides.forEach((s) => {
        const slide = pptx.addSlide();
        slide.background = { color: 'FFFFFF' };
        slide.addText(s.title, {
          x: 0.8,
          y: 0.8,
          w: '85%',
          fontSize: 22,
          bold: true,
          color: '4F46E5',
        });

        const items = s.bulletPoints.map((bp) => ({
          text: bp,
          options: { fontSize: 15, bullet: true, color: '1E1B2E' },
        }));

        slide.addText(items as any, {
          x: 0.8,
          y: 1.8,
          w: '85%',
          h: 4.5,
        });

        if (s.speakerNotes) {
          slide.addNotes(s.speakerNotes);
        }
      });

      await pptx.writeFile({ fileName: `${presentation.title || 'Presentation'}.pptx` });
      addToast('PowerPoint deck (.pptx) downloaded!');
    } catch (err: any) {
      addToast(`PPTX export failed: ${err.message}`, false);
    }
  };

  // Export to PDF
  const exportToPdf = () => {
    if (!presentation) return;
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [960, 540] });

      presentation.slides.forEach((s, idx) => {
        if (idx > 0) doc.addPage([960, 540], 'landscape');

        // Background
        doc.setFillColor(247, 247, 251);
        doc.rect(0, 0, 960, 540, 'F');

        // Slide title
        doc.setFontSize(26);
        doc.setTextColor(79, 70, 229); // Primary purple
        doc.text(s.title, 60, 70);

        // Slide Number
        doc.setFontSize(12);
        doc.setTextColor(107, 114, 128);
        doc.text(`${idx + 1} / ${presentation.slides.length}`, 880, 70);

        // Bullet points
        doc.setFontSize(16);
        doc.setTextColor(30, 27, 46);
        let y = 140;
        s.bulletPoints.forEach((bp) => {
          const lines = doc.splitTextToSize(`• ${bp}`, 820);
          doc.text(lines, 60, y);
          y += lines.length * 24 + 10;
        });

        // Speaker notes
        if (s.speakerNotes) {
          doc.setFontSize(11);
          doc.setTextColor(150, 150, 160);
          const notes = doc.splitTextToSize(`Notes: ${s.speakerNotes}`, 820);
          doc.text(notes, 60, 480);
        }
      });

      doc.save(`${presentation.title || 'Presentation'}.pdf`);
      addToast('PDF presentation exported!');
    } catch (err: any) {
      addToast(`PDF export failed: ${err.message}`, false);
    }
  };

  const activeSlide: Slide | undefined = presentation?.slides[currentSlideIndex];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Presentation Deck Generator</h1>
        <p className="text-sm text-muted">Turn your notes and topics into professional slide decks with speaker notes and exports.</p>
      </div>

      {/* Generator Controls */}
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
              placeholder="Presentation topic, e.g. 'Overview of Quantum Cryptography' or 'The French Revolution'"
              value={freeTopic}
              onChange={(e) => setFreeTopic(e.target.value)}
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Slide Count</label>
          <select
            value={slideCount}
            onChange={(e) => setSlideCount(parseInt(e.target.value, 10))}
            className="w-full sm:w-48"
          >
            <option value={5}>5 Slides (Summary Pitch)</option>
            <option value={6}>6 Slides (Standard Presentation)</option>
            <option value={8}>8 Slides (Detailed Walkthrough)</option>
            <option value={10}>10 Slides (Comprehensive Lecture)</option>
          </select>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="btn text-sm w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" /> Crafting Presentation…
            </>
          ) : (
            <>
              <Presentation className="w-4 h-4" /> Generate Slide Deck
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

      {/* Presentation Viewer */}
      {presentation && activeSlide && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">{presentation.title}</h2>
              {presentation.subtitle && (
                <p className="text-xs text-muted">{presentation.subtitle}</p>
              )}
            </div>

            {/* Export and present buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowNotes(!showNotes)}
                className={`btn-o text-xs py-1.5 px-3 flex items-center gap-1.5 ${
                  showNotes ? 'bg-indigo-50 border-primary text-primary' : ''
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {showNotes ? 'Hide Notes' : 'Speaker Notes'}
              </button>
              <button
                onClick={exportToPptx}
                className="btn-o text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-orange-500" /> Export .pptx
              </button>
              <button
                onClick={exportToPdf}
                className="btn-o text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5 text-red-500" /> Export PDF
              </button>
              <button
                onClick={() => setIsFullscreen(true)}
                className="btn text-xs py-1.5 px-3.5 flex items-center gap-1.5"
              >
                <Maximize2 className="w-3.5 h-3.5" /> Present Fullscreen
              </button>
            </div>
          </div>

          {/* Slide Stage Container */}
          <div
            className={`card relative overflow-hidden transition-all ${
              isFullscreen
                ? 'fixed inset-0 z-50 rounded-none border-none p-8 md:p-16 flex flex-col justify-between bg-zinc-950 text-white'
                : 'aspect-[16/9] p-6 md:p-10 flex flex-col justify-between shadow-xl'
            }`}
          >
            {/* Top Bar of Slide */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-widest text-primary uppercase">
                Slide {currentSlideIndex + 1} of {presentation.slides.length}
              </span>
              {isFullscreen && (
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                  title="Exit Fullscreen (Esc)"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Slide Body */}
            <div className="my-auto space-y-5">
              <h3
                className={`font-extrabold tracking-tight ${
                  isFullscreen ? 'text-3xl md:text-5xl text-white' : 'text-2xl md:text-3xl text-foreground'
                }`}
              >
                {activeSlide.title}
              </h3>

              <ul className="space-y-3 pl-2">
                {activeSlide.bulletPoints.map((bp, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-3 ${
                      isFullscreen ? 'text-lg md:text-xl text-zinc-200' : 'text-sm md:text-base text-foreground/90'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0"></span>
                    <span>{bp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bottom Controls / Speaker Notes */}
            <div className="space-y-3">
              {showNotes && activeSlide.speakerNotes && (
                <div
                  className={`p-3 rounded-lg text-xs border ${
                    isFullscreen
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                      : 'bg-zinc-50 dark:bg-zinc-900/60 border-border text-muted'
                  }`}
                >
                  <strong className="text-primary font-semibold">Speaker Notes: </strong>
                  {activeSlide.speakerNotes}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs opacity-60">
                  {presentation.title}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentSlideIndex === 0}
                    className={`p-2 rounded-lg ${
                      isFullscreen ? 'bg-white/10 hover:bg-white/20 disabled:opacity-30' : 'btn-o py-1 px-3 text-xs'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono">
                    {currentSlideIndex + 1} / {presentation.slides.length}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentSlideIndex((prev) => Math.min(presentation.slides.length - 1, prev + 1))
                    }
                    disabled={currentSlideIndex === presentation.slides.length - 1}
                    className={`p-2 rounded-lg ${
                      isFullscreen ? 'bg-white/10 hover:bg-white/20 disabled:opacity-30' : 'btn-o py-1 px-3 text-xs'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Slide thumbnails strip */}
          <div className="flex gap-2 overflow-x-auto pb-2 pt-1">
            {presentation.slides.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlideIndex(idx)}
                className={`card p-2 text-left w-36 shrink-0 transition-all ${
                  idx === currentSlideIndex
                    ? 'ring-2 ring-primary border-transparent'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                <div className="text-[10px] text-muted font-bold mb-1">#{idx + 1}</div>
                <div className="text-xs font-semibold truncate text-foreground">{s.title}</div>
                <div className="text-[10px] text-muted truncate mt-0.5">
                  {s.bulletPoints.length} points
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Saved Presentations History */}
      {savedPresentations.length > 0 && (
        <div className="space-y-3 pt-3">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <History className="w-4 h-4 text-muted" /> Saved Presentations
          </h2>
          <div className="grid gap-2">
            {savedPresentations.map((p) => (
              <div
                key={p.id}
                className="card p-3.5 flex justify-between items-center text-sm"
              >
                <div>
                  <p className="font-semibold text-foreground">{p.topic}</p>
                  <p className="text-xs text-muted">
                    {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setPresentation(p.slides);
                    setCurrentSlideIndex(0);
                    addToast(`Opened presentation: ${p.topic}`);
                  }}
                  className="btn-o text-xs py-1 px-3"
                >
                  View Deck
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
