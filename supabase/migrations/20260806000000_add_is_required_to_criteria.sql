-- Migration to add is_required column to rubric_criteria
ALTER TABLE public.rubric_criteria ADD COLUMN is_required BOOLEAN NOT NULL DEFAULT true;
