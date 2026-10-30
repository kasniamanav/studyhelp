import { describe, it, expect } from 'vitest';

export function calculateQuizScore(
  questions: { correctAnswer: number }[],
  answers: Record<number, number>
) {
  let score = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.correctAnswer) {
      score++;
    }
  });
  const total = questions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  return { score, total, percentage };
}

export function calculateMockScore(
  questions: { correctAnswer: number }[],
  answers: Record<number, number>
) {
  let score = 0;
  let unattempted = 0;

  questions.forEach((q, i) => {
    if (answers[i] === undefined) {
      unattempted++;
    } else if (answers[i] === q.correctAnswer) {
      score++;
    }
  });

  const total = questions.length;
  const wrong = total - score - unattempted;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return { score, wrong, unattempted, total, percentage };
}

describe('Quiz & Mock Scoring Logic', () => {
  it('correctly scores a 5-question quiz with all correct answers', () => {
    const questions = [
      { correctAnswer: 0 },
      { correctAnswer: 1 },
      { correctAnswer: 2 },
      { correctAnswer: 3 },
      { correctAnswer: 0 },
    ];
    const answers = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 0 };
    const res = calculateQuizScore(questions, answers);

    expect(res.score).toBe(5);
    expect(res.total).toBe(5);
    expect(res.percentage).toBe(100);
  });

  it('correctly scores partial answers with incorrect ones', () => {
    const questions = [
      { correctAnswer: 0 },
      { correctAnswer: 1 },
      { correctAnswer: 2 },
      { correctAnswer: 3 },
    ];
    const answers = { 0: 0, 1: 2, 2: 2, 3: 0 }; // 0 and 2 are right (2/4 = 50%)
    const res = calculateQuizScore(questions, answers);

    expect(res.score).toBe(2);
    expect(res.percentage).toBe(50);
  });

  it('correctly calculates mock test stats including unattempted and wrong', () => {
    const questions = [
      { correctAnswer: 1 },
      { correctAnswer: 2 },
      { correctAnswer: 0 },
      { correctAnswer: 3 },
      { correctAnswer: 1 },
    ];
    // answer 0 is right (1)
    // answer 1 is wrong (0 instead of 2)
    // answer 2 is skipped (undefined)
    // answer 3 is right (3)
    // answer 4 is skipped (undefined)
    const answers = { 0: 1, 1: 0, 3: 3 };

    const res = calculateMockScore(questions, answers);
    expect(res.score).toBe(2);
    expect(res.wrong).toBe(1);
    expect(res.unattempted).toBe(2);
    expect(res.total).toBe(5);
    expect(res.percentage).toBe(40);
  });
});

