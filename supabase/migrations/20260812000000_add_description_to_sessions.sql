-- Add description column to sessions table if not present
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS description TEXT;

-- Update submit_evaluation_turn function to accept p_session_description and use custom date format fallback
CREATE OR REPLACE FUNCTION public.submit_evaluation_turn(
  p_session_id UUID,
  p_feature_id UUID,
  p_rubric_version_id UUID,
  p_session_name TEXT,
  p_prompt TEXT,
  p_response TEXT,
  p_source_url TEXT,
  p_turn_number INT,
  p_scores JSONB, -- JSON array of {criterion_id: uuid, value: text, notes: text}
  p_session_description TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_session_id UUID := p_session_id;
  v_turn_id UUID;
  v_score_record RECORD;
  v_default_name TEXT;
  v_day_num INT;
  v_suffix TEXT;
BEGIN
  -- Verify the active user is an evaluator or admin
  IF NOT public.current_user_is_evaluator_or_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only evaluators and admins can submit scores.';
  END IF;

  -- Generate default formatted date name (e.g. Aug. 11th, 2026)
  v_day_num := to_number(to_char(now(), 'DD'), '99');
  IF v_day_num IN (1, 21, 31) THEN v_suffix := 'st';
  ELSIF v_day_num IN (2, 22) THEN v_suffix := 'nd';
  ELSIF v_day_num IN (3, 23) THEN v_suffix := 'rd';
  ELSE v_suffix := 'th';
  END IF;

  v_default_name := to_char(now(), 'Mon. ') || v_day_num || v_suffix || to_char(now(), ', YYYY');

  -- 1. Create a session if not provided (i.e. first turn of a conversation)
  IF v_session_id IS NULL THEN
    IF p_feature_id IS NULL OR p_rubric_version_id IS NULL THEN
      RAISE EXCEPTION 'Invalid parameters: feature_id and rubric_version_id are required to create a new session.';
    END IF;
    
    INSERT INTO public.sessions (feature_id, rubric_version_id, evaluator_id, name, description)
    VALUES (
      p_feature_id, 
      p_rubric_version_id, 
      auth.uid(), 
      coalesce(p_session_name, v_default_name),
      p_session_description
    )
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

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'turn_id', v_turn_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
