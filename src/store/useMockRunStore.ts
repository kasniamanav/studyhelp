import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { QuizQuestion } from '../lib/schemas';

interface MockRunState {
  isActive: boolean;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questions: QuizQuestion[];
  answers: Record<number, number>;
  marked: number[]; // Array of indices marked for review
  currentIndex: number;
  durationSec: number;
  timeLeftSec: number;
  isSubmitted: boolean;

  startMock: (params: {
    topic: string;
    difficulty: 'easy' | 'medium' | 'hard';
    questions: QuizQuestion[];
    minutes: number;
  }) => void;
  setAnswer: (questionIndex: number, optionIndex: number) => void;
  toggleMark: (questionIndex: number) => void;
  goToIndex: (index: number) => void;
  decrementTimer: () => void;
  submitMock: () => void;
  resetMock: () => void;
}

export const useMockRunStore = create<MockRunState>()(
  persist(
    (set, get) => ({
      isActive: false,
      topic: '',
      difficulty: 'medium',
      questions: [],
      answers: {},
      marked: [],
      currentIndex: 0,
      durationSec: 1200,
      timeLeftSec: 1200,
      isSubmitted: false,

      startMock: ({ topic, difficulty, questions, minutes }) => {
        const durationSec = minutes * 60;
        set({
          isActive: true,
          topic,
          difficulty,
          questions,
          answers: {},
          marked: [],
          currentIndex: 0,
          durationSec,
          timeLeftSec: durationSec,
          isSubmitted: false,
        });
      },

      setAnswer: (qIndex, optIndex) => {
        const { answers, isSubmitted } = get();
        if (isSubmitted) return;
        set({ answers: { ...answers, [qIndex]: optIndex } });
      },

      toggleMark: (qIndex) => {
        const { marked, isSubmitted } = get();
        if (isSubmitted) return;
        const exists = marked.includes(qIndex);
        set({
          marked: exists ? marked.filter((i) => i !== qIndex) : [...marked, qIndex],
        });
      },

      goToIndex: (index) => {
        const { questions } = get();
        if (index >= 0 && index < questions.length) {
          set({ currentIndex: index });
        }
      },

      decrementTimer: () => {
        const { timeLeftSec, isSubmitted, submitMock } = get();
        if (isSubmitted) return;
        if (timeLeftSec <= 1) {
          set({ timeLeftSec: 0 });
          submitMock();
        } else {
          set({ timeLeftSec: timeLeftSec - 1 });
        }
      },

      submitMock: () => {
        set({ isSubmitted: true, isActive: false });
      },

      resetMock: () => {
        set({
          isActive: false,
          topic: '',
          questions: [],
          answers: {},
          marked: [],
          currentIndex: 0,
          durationSec: 0,
          timeLeftSec: 0,
          isSubmitted: false,
        });
      },
    }),
    {
      name: 'studyai-mock-run',
    }
  )
);

