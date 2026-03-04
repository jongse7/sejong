insert into public.profiles (
  display_name,
  headline,
  bio,
  socials
)
values (
  'Your Name',
  'Full-Stack TypeScript Developer',
  'Write your short bio here.',
  jsonb_build_object(
    'github', 'https://github.com/your-id',
    'linkedin', 'https://www.linkedin.com/in/your-id',
    'instagram', 'https://www.instagram.com/your-id/'
  )
)
on conflict do nothing;
