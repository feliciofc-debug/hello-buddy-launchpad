
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.jarvis_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_number text NOT NULL,
  content text NOT NULL,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_jarvis_notes_user ON public.jarvis_notes(user_id, contact_number, created_at DESC);
CREATE INDEX idx_jarvis_notes_content_trgm ON public.jarvis_notes USING gin (content gin_trgm_ops);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_notes TO authenticated;
GRANT ALL ON public.jarvis_notes TO service_role;
ALTER TABLE public.jarvis_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes" ON public.jarvis_notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.jarvis_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_number text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_jarvis_tasks_user ON public.jarvis_tasks(user_id, contact_number, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_tasks TO authenticated;
GRANT ALL ON public.jarvis_tasks TO service_role;
ALTER TABLE public.jarvis_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks" ON public.jarvis_tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
