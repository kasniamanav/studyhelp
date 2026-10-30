-- Sample seed data for demo purposes (can be run in Supabase SQL editor after a user signs up)
-- Replace '00000000-0000-0000-0000-000000000000' with your actual auth.uid() if testing manually.

DO $$
DECLARE
  demo_user_id uuid;
BEGIN
  -- Select the first existing user from auth.users if any exists
  SELECT id INTO demo_user_id FROM auth.users LIMIT 1;
  
  IF demo_user_id IS NOT NULL THEN
    -- Insert sample materials
    INSERT INTO public.materials (user_id, title, subject, topic, content)
    VALUES 
    (
      demo_user_id,
      'Cellular Respiration and Photosynthesis',
      'Biology',
      'Cell Biology',
      'Photosynthesis occurs in chloroplasts where chlorophyll absorbs sunlight to convert carbon dioxide and water into glucose and oxygen. The light reactions happen in thylakoid membranes generating ATP and NADPH, while the Calvin cycle fixes carbon in the stroma. Cellular respiration in mitochondria breaks glucose down through glycolysis, the Krebs cycle, and oxidative phosphorylation yielding around 30-32 ATP.'
    ),
    (
      demo_user_id,
      'Newtonian Mechanics & Laws of Motion',
      'Physics',
      'Classical Mechanics',
      'Newton''s First Law states an object at rest stays at rest unless acted upon by an unbalanced force (inertia). Newton''s Second Law defines F = ma, relating force, mass, and acceleration. Newton''s Third Law states for every action force there is an equal and opposite reaction force. Momentum p = mv is conserved in closed systems.'
    ),
    (
      demo_user_id,
      'French Common Verb Tenses',
      'French',
      'Grammar',
      'Present tense endings for -er verbs: e, es, e, ons, ez, ent. Passé composé uses auxiliary avoir or être with the past participle. Imparfait expresses ongoing or habitual past actions using the nous stem plus ais, ais, ait, ions, iez, aient. Futur simple adds ai, as, a, ons, ez, ont to the infinitive stem.'
    )
    ON CONFLICT DO NOTHING;

    -- Insert sample quiz attempts
    INSERT INTO public.quiz_attempts (user_id, topic, type, difficulty, score, total, time_taken_sec, questions, answers)
    VALUES
    (
      demo_user_id,
      'Photosynthesis Basics',
      'quiz',
      'medium',
      4,
      5,
      120,
      '[{"question": "Where do light-dependent reactions occur?", "options": ["Stroma", "Thylakoid membranes", "Matrix", "Outer membrane"], "correctAnswer": 1, "explanation": "Light reactions occur in thylakoid membranes."}]'::jsonb,
      '{"0": 1}'::jsonb
    ),
    (
      demo_user_id,
      'Classical Mechanics Test',
      'mock',
      'hard',
      8,
      10,
      480,
      '[{"question": "What is the formula for momentum?", "options": ["F = ma", "p = mv", "W = Fd", "E = mc^2"], "correctAnswer": 1, "explanation": "Momentum is mass times velocity."}]'::jsonb,
      '{"0": 1}'::jsonb
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

