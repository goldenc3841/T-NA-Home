-- Alter rubrics table to support saving the in-progress criterion form input states
ALTER TABLE public.rubrics
ADD COLUMN draft_form_state JSONB DEFAULT NULL;
