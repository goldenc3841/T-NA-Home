-- Migration: Save role and company_id metadata from user invitations to public.profiles

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, company_id)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    CASE 
      WHEN LOWER(new.email) IN ('goldenc5310@gmail.com', 'pisurajc@gmail.com') THEN 'admin'
      ELSE coalesce(new.raw_user_meta_data->>'role', 'evaluator')
    END,
    CASE 
      WHEN (new.raw_user_meta_data->>'company_id') IS NOT NULL AND (new.raw_user_meta_data->>'company_id') != '' THEN (new.raw_user_meta_data->>'company_id')::uuid
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    role = CASE 
      WHEN LOWER(new.email) IN ('goldenc5310@gmail.com', 'pisurajc@gmail.com') THEN 'admin'
      ELSE coalesce(EXCLUDED.role, public.profiles.role)
    END,
    company_id = coalesce(EXCLUDED.company_id, public.profiles.company_id);
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
