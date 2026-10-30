import { describe, it, expect } from 'vitest';
import { QuizQuestionSchema, ExplainSchema } from '../lib/schemas';
import { cleanJsonString } from '../../supabase/functions/ai/providers';

describe('Validation and JSON Parsing', () => {
  it('validates a valid MCQ question shape', () => {
    const validQ = {
      question: 'What is photosynthesis?',
      options: ['Plant energy process', 'Cell breakdown', 'Animal respiration'],
      correctAnswer: 0,
      explanation: 'Plants convert light into chemical energy.',
    };

    const parsed = QuizQuestionSchema.safeParse(validQ);
    expect(parsed.success).toBe(true);
  });

  it('rejects an MCQ question where correctAnswer index is out of bounds', () => {
    const invalidQ = {
      question: 'What is photosynthesis?',
      options: ['Option A', 'Option B'],
      correctAnswer: 5, // out of bounds
    };

    const parsed = QuizQuestionSchema.safeParse(invalidQ);
    expect(parsed.success).toBe(false);
  });

  it('validates a comprehensive ExplainSchema object', () => {
    const explainObj = {
      overview: 'Overview of Newtonian mechanics.',
      keyPoints: ['Inertia', 'F = ma', 'Action-Reaction'],
      examples: ['Dropping a ball', 'Rockets'],
      definitions: [{ term: 'Inertia', definition: 'Resistance to change in motion' }],
      commonMistakes: ['Confusing mass and weight'],
      examTips: ['Always state units'],
      quickRevision: ['F = ma'],
    };

    const parsed = ExplainSchema.safeParse(explainObj);
    expect(parsed.success).toBe(true);
  });

  it('strips markdown code blocks and whitespace cleanly from JSON string', () => {
    const rawWithMarkdown = '```json\n{"overview": "Great overview", "keyPoints": []}\n```';
    const cleaned = cleanJsonString(rawWithMarkdown);
    expect(cleaned).toBe('{"overview": "Great overview", "keyPoints": []}');
    expect(() => JSON.parse(cleaned)).not.toThrow();
  });

  it('extracts embedded JSON array from conversational text', () => {
    const rawConversational = 'Here is your quiz:\n[{"question": "Q1", "options": ["A", "B"], "correctAnswer": 0}]\nEnjoy studying!';
    const cleaned = cleanJsonString(rawConversational);
    expect(cleaned).toBe('[{"question": "Q1", "options": ["A", "B"], "correctAnswer": 0}]');
    expect(() => JSON.parse(cleaned)).not.toThrow();
  });
});

