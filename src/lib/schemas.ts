import { z } from 'zod';

// Explain Schema
export const DefinitionSchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
});

export const ExplainSchema = z.object({
  overview: z.string().min(1),
  keyPoints: z.array(z.string()).default([]),
  examples: z.array(z.string()).default([]),
  definitions: z.array(DefinitionSchema).default([]),
  commonMistakes: z.array(z.string()).default([]),
  examTips: z.array(z.string()).default([]),
  quickRevision: z.array(z.string()).default([]),
});

export type ExplainData = z.infer<typeof ExplainSchema>;

// Quiz & Mock Schema (matching validQ check from prototype)
export const QuizQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).min(2),
  correctAnswer: z.number().int().min(0),
  explanation: z.string().optional().default(''),
}).refine(
  (data) => data.correctAnswer >= 0 && data.correctAnswer < data.options.length,
  { message: 'correctAnswer must be a valid option index' }
);

export const QuizArraySchema = z.array(QuizQuestionSchema).min(1);

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

// Flashcards Schema
export const FlashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
});

export const FlashcardArraySchema = z.array(FlashcardSchema).min(1);

export type Flashcard = z.infer<typeof FlashcardSchema>;

// Presentation Slide Deck Schema
export const SlideSchema = z.object({
  slideNumber: z.number().int(),
  title: z.string().min(1),
  bulletPoints: z.array(z.string()).default([]),
  speakerNotes: z.string().optional().default(''),
});

export const PresentationSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional().default(''),
  slides: z.array(SlideSchema).min(1),
});

export type Slide = z.infer<typeof SlideSchema>;
export type PresentationData = z.infer<typeof PresentationSchema>;

