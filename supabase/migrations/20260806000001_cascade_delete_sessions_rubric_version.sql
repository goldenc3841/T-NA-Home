-- Drop existing restrict constraint and replace with cascade constraint
ALTER TABLE public.sessions
DROP CONSTRAINT IF EXISTS sessions_rubric_version_id_fkey,
ADD CONSTRAINT sessions_rubric_version_id_fkey
    FOREIGN KEY (rubric_version_id)
    REFERENCES public.rubric_versions(id)
    ON DELETE CASCADE;
