export function getExplainPrompt(topic: string, content?: string, level: string = 'simple'): string {
  const levelDesc: Record<string, string> = {
    beginner: 'a total beginner, very simple everyday language with relatable analogies',
    simple: 'a simple, clear and concise explanation',
    detailed: 'a detailed, thorough, academic and rigorous explanation',
    exam: 'exam-focused, highlighting what is frequently tested, marking points and key terminology',
  };
  const desc = levelDesc[level] || levelDesc.simple;
  const materialContext = content?.trim()
    ? `\nStudy material from the student:\n"""${content.slice(0, 6000)}"""\nBase your explanation primarily on this material.`
    : '';

  return `You are an expert academic tutor and pedagogical master.
Topic: "${topic}".${materialContext}

Write ${desc}.
Reply with ONLY a valid, raw JSON object (no markdown code blocks, no backticks, no text before or after).
The JSON object must match this exact shape:
{
  "overview": "string (comprehensive overview explaining the concept)",
  "keyPoints": ["string", "string"],
  "examples": ["string", "string"],
  "definitions": [{"term": "string", "definition": "string"}],
  "commonMistakes": ["string", "string"],
  "examTips": ["string", "string"],
  "quickRevision": ["string", "string"]
}`;
}

export function getQuizPrompt(topic: string, content?: string, count: number = 5, difficulty: string = 'medium'): string {
  const materialContext = content?.trim()
    ? `\nBase the questions strictly on this material:\n"""${content.slice(0, 6000)}"""`
    : '';

  return `Create ${count} multiple-choice questions at "${difficulty}" difficulty about: "${topic}".${materialContext}

Reply with ONLY a valid raw JSON array (no markdown code blocks, no backticks, no intro or outro text) of exactly ${count} items shaped like:
[
  {
    "question": "string (clear and unambiguous question stem)",
    "options": ["option A", "option B", "option C", "option D"],
    "correctAnswer": 0,
    "explanation": "string (why this answer is correct and others are not)"
  }
]
Note: correctAnswer MUST be a 0-based integer index pointing to the right option in options (0 to options.length - 1). Provide exactly 4 options per question.`;
}

export function getFlashcardPrompt(topic: string, content?: string, count: number = 10): string {
  const materialContext = content?.trim()
    ? `\nBase the flashcards on this material:\n"""${content.slice(0, 6000)}"""`
    : '';

  return `Create ${count} high-yield flashcards for studying: "${topic}".${materialContext}

Reply with ONLY a valid raw JSON array (no markdown code blocks, no backticks) of exactly ${count} items shaped like:
[
  {
    "front": "term, question, or key concept",
    "back": "concise definition, formula, or clear explanation"
  }
]`;
}

export function getPresentationPrompt(topic: string, content?: string, slideCount: number = 6): string {
  const materialContext = content?.trim()
    ? `\nBase the presentation on this material:\n"""${content.slice(0, 6000)}"""`
    : '';

  return `Create a structured presentation slide deck of ${slideCount} slides about: "${topic}".${materialContext}
Include:
1. Title slide
2. Agenda / Overview
3. Core concept slides (with 3-5 punchy bullet points each)
4. Key takeaways / Summary slide

Reply with ONLY a valid raw JSON object (no markdown formatting, no backticks) shaped like:
{
  "title": "Main presentation title",
  "subtitle": "Subtitle or topic focus",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide Title",
      "bulletPoints": ["point 1", "point 2", "point 3"],
      "speakerNotes": "Guidance and talking points for the presenter"
    }
  ]
}`;
}

export function getChatSystemPrompt(topic?: string, content?: string): string {
  let prompt = 'You are StudyAI, an encouraging, patient, and highly intelligent academic tutor.\n';
  if (topic) {
    prompt += `Current study topic: "${topic}".\n`;
  }
  if (content && content.trim()) {
    prompt += `Relevant study material reference:\n"""\n${content.slice(0, 4000)}\n"""\nUse this context to answer student queries accurately.\n`;
  }
  prompt += 'Explain things simply and clearly. Use concise formatting, bold key terms, and bullet points where helpful. If asked for tests or flashcards, you can offer them.';
  return prompt;
}

