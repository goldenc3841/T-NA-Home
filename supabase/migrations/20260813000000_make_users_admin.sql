-- Migration: Set goldenc5310@gmail.com and pisurajc@gmail.com as Admins

-- 1. Update existing profiles for goldenc5310@gmail.com and pisurajc@gmail.com
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
  SELECT id 
  FROM auth.users 
  WHERE LOWER(email) IN ('goldenc5310@gmail.com', 'pisurajc@gmail.com')
);

-- 2. Update handle_new_user trigger function to automatically grant admin role to these email addresses upon creation
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
    (new.raw_user_meta_data->>'company_id')::uuid
  )
  ON CONFLICT (id) DO UPDATE 
  SET role = CASE 
    WHEN LOWER(new.email) IN ('goldenc5310@gmail.com', 'pisurajc@gmail.com') THEN 'admin'
    ELSE public.profiles.role
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
