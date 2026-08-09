-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. Table Definitions
-- ==========================================

-- Client Companies
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Profiles (linked to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY, -- references auth.users (linked manually or by trigger)
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'evaluator', 'client_viewer')) DEFAULT 'evaluator',
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Features (under evaluation for a company)
CREATE TABLE public.features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, name)
);

-- Rubrics (saved by client)
CREATE TABLE public.rubrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    draft_form_state JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rubric Versions (version history for schema changes)
CREATE TABLE public.rubric_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rubric_id UUID NOT NULL REFERENCES public.rubrics(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (rubric_id, version_number)
);

-- Rubric Criteria (individual scoring items)
CREATE TABLE public.rubric_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rubric_version_id UUID NOT NULL REFERENCES public.rubric_versions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    field_type TEXT NOT NULL CHECK (field_type IN ('rating', 'text', 'boolean', 'select')),
    field_options JSONB DEFAULT NULL, -- configuration (e.g. ['option1', 'option2'] or {min: 1, max: 5})
    is_required BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Evaluation Sessions
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
    rubric_version_id UUID NOT NULL REFERENCES public.rubric_versions(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Turns (conversational steps inside a session)
CREATE TABLE public.turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    source_url TEXT,
    turn_number INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, turn_number)
);

-- Scores (values evaluated per turn, per criterion)
CREATE TABLE public.scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turn_id UUID NOT NULL REFERENCES public.turns(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES public.rubric_criteria(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (turn_id, criterion_id)
);

-- ==========================================
-- 2. Performance Indices
-- ==========================================
CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX idx_features_company_id ON public.features(company_id);
CREATE INDEX idx_rubrics_company_id ON public.rubrics(company_id);
CREATE INDEX idx_rubric_versions_rubric_id ON public.rubric_versions(rubric_id);
CREATE INDEX idx_rubric_criteria_rubric_version ON public.rubric_criteria(rubric_version_id);
CREATE INDEX idx_sessions_feature_id ON public.sessions(feature_id);
CREATE INDEX idx_sessions_rubric_version_id ON public.sessions(rubric_version_id);
CREATE INDEX idx_turns_session_id ON public.turns(session_id);
CREATE INDEX idx_scores_turn_id ON public.scores(turn_id);
CREATE INDEX idx_scores_criterion_id ON public.scores(criterion_id);

-- ==========================================
-- 3. Security Definining Helper Functions for RLS (Avoids policy recursion)
-- ==========================================

CREATE OR REPLACE FUNCTION public.current_user_is_evaluator_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'evaluator')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT company_id FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 4. Row Level Security Policies
-- ==========================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY select_profiles ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.current_user_is_evaluator_or_admin());

CREATE POLICY insert_profiles ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (public.current_user_is_evaluator_or_admin());

CREATE POLICY update_profiles ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.current_user_is_evaluator_or_admin());

-- Companies Policies
CREATE POLICY select_companies ON public.companies
    FOR SELECT TO authenticated
    USING (public.current_user_is_evaluator_or_admin() OR id = public.current_user_company_id());

CREATE POLICY all_companies ON public.companies
    FOR ALL TO authenticated
    USING (public.current_user_is_evaluator_or_admin());

-- Features Policies
CREATE POLICY select_features ON public.features
    FOR SELECT TO authenticated
    USING (public.current_user_is_evaluator_or_admin() OR company_id = public.current_user_company_id());

CREATE POLICY all_features ON public.features
    FOR ALL TO authenticated
    USING (public.current_user_is_evaluator_or_admin());

-- Rubrics Policies
CREATE POLICY select_rubrics ON public.rubrics
    FOR SELECT TO authenticated
    USING (public.current_user_is_evaluator_or_admin() OR company_id = public.current_user_company_id());

CREATE POLICY all_rubrics ON public.rubrics
    FOR ALL TO authenticated
    USING (public.current_user_is_evaluator_or_admin());

-- Rubric Versions Policies
CREATE POLICY select_rubric_versions ON public.rubric_versions
    FOR SELECT TO authenticated
    USING (
        public.current_user_is_evaluator_or_admin() OR 
        EXISTS (SELECT 1 FROM public.rubrics WHERE id = rubric_versions.rubric_id AND company_id = public.current_user_company_id())
    );

CREATE POLICY all_rubric_versions ON public.rubric_versions
    FOR ALL TO authenticated
    USING (public.current_user_is_evaluator_or_admin());

-- Rubric Criteria Policies
CREATE POLICY select_rubric_criteria ON public.rubric_criteria
    FOR SELECT TO authenticated
    USING (
        public.current_user_is_evaluator_or_admin() OR 
        EXISTS (
            SELECT 1 FROM public.rubric_versions rv
            JOIN public.rubrics r ON r.id = rv.rubric_id
            WHERE rv.id = rubric_criteria.rubric_version_id AND r.company_id = public.current_user_company_id()
        )
    );

CREATE POLICY all_rubric_criteria ON public.rubric_criteria
    FOR ALL TO authenticated
    USING (public.current_user_is_evaluator_or_admin());

-- Sessions Policies
CREATE POLICY select_sessions ON public.sessions
    FOR SELECT TO authenticated
    USING (
        public.current_user_is_evaluator_or_admin() OR 
        EXISTS (SELECT 1 FROM public.features WHERE id = sessions.feature_id AND company_id = public.current_user_company_id())
    );

CREATE POLICY all_sessions ON public.sessions
    FOR ALL TO authenticated
    USING (public.current_user_is_evaluator_or_admin());

-- Turns Policies
CREATE POLICY select_turns ON public.turns
    FOR SELECT TO authenticated
    USING (
        public.current_user_is_evaluator_or_admin() OR 
        EXISTS (
            SELECT 1 FROM public.sessions s
            JOIN public.features f ON f.id = s.feature_id
            WHERE s.id = turns.session_id AND f.company_id = public.current_user_company_id()
        )
    );

CREATE POLICY all_turns ON public.turns
    FOR ALL TO authenticated
    USING (public.current_user_is_evaluator_or_admin());

-- Scores Policies
CREATE POLICY select_scores ON public.scores
    FOR SELECT TO authenticated
    USING (
        public.current_user_is_evaluator_or_admin() OR 
        EXISTS (
            SELECT 1 FROM public.turns t
            JOIN public.sessions s ON s.id = t.session_id
            JOIN public.features f ON f.id = s.feature_id
            WHERE t.id = scores.turn_id AND f.company_id = public.current_user_company_id()
        )
    );

CREATE POLICY all_scores ON public.scores
    FOR ALL TO authenticated
    USING (public.current_user_is_evaluator_or_admin());

-- ==========================================
-- 5. Automatic Profiles Sync Trigger
-- ==========================================

-- Trigger to sync auth.users with public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, company_id)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'evaluator'), -- default to evaluator
    (new.raw_user_meta_data->>'company_id')::uuid
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 6. Atomic Transaction Function for Turn Evaluations Ingestion
-- ==========================================

CREATE OR REPLACE FUNCTION public.submit_evaluation_turn(
  p_session_id UUID,
  p_feature_id UUID,
  p_rubric_version_id UUID,
  p_session_name TEXT,
  p_prompt TEXT,
  p_response TEXT,
  p_source_url TEXT,
  p_turn_number INT,
  p_scores JSONB -- JSON array of {criterion_id: uuid, value: text, notes: text}
) RETURNS JSONB AS $$
DECLARE
  v_session_id UUID := p_session_id;
  v_turn_id UUID;
  v_score_record RECORD;
BEGIN
  -- Verify the active user is an evaluator or admin
  IF NOT public.current_user_is_evaluator_or_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only evaluators and admins can submit scores.';
  END IF;

  -- 1. Create a session if not provided (i.e. first turn of a conversation)
  IF v_session_id IS NULL THEN
    IF p_feature_id IS NULL OR p_rubric_version_id IS NULL THEN
      RAISE EXCEPTION 'Invalid parameters: feature_id and rubric_version_id are required to create a new session.';
    END IF;
    
    INSERT INTO public.sessions (feature_id, rubric_version_id, evaluator_id, name)
    VALUES (p_feature_id, p_rubric_version_id, auth.uid(), coalesce(p_session_name, 'Session ' || to_char(now(), 'YYYY-MM-DD HH24:MI')))
    RETURNING id INTO v_session_id;
  END IF;

  -- 2. Insert the turn
  INSERT INTO public.turns (session_id, prompt, response, source_url, turn_number)
  VALUES (
    v_session_id, 
    p_prompt, 
    p_response, 
    p_source_url, 
    coalesce(p_turn_number, (SELECT coalesce(max(turn_number), 0) + 1 FROM public.turns WHERE session_id = v_session_id))
  )
  RETURNING id INTO v_turn_id;

  -- 3. Insert scores for each criterion
  FOR v_score_record IN SELECT * FROM jsonb_to_recordset(p_scores) AS x(criterion_id UUID, value TEXT, notes TEXT)
  LOOP
    INSERT INTO public.scores (turn_id, criterion_id, value, notes)
    VALUES (v_turn_id, v_score_record.criterion_id, v_score_record.value, v_score_record.notes);
  END LOOP;

  -- 4. Update session timestamp
  UPDATE public.sessions SET updated_at = now() WHERE id = v_session_id;

  RETURN jsonb_build_object('session_id', v_session_id, 'turn_id', v_turn_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
