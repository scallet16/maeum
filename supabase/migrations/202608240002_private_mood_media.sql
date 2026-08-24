begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-media', 'student-media', false, 10485760,
  array['audio/webm','audio/mp4','audio/ogg','audio/mpeg','image/png','image/jpeg','image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.daily_moods'::regclass
      and conname = 'daily_moods_id_student_class_key'
  ) then
    alter table public.daily_moods
      add constraint daily_moods_id_student_class_key
      unique (id, student_id, class_id);
  end if;
end
$$;

create table if not exists public.mood_media (
  id uuid not null default gen_random_uuid(),
  mood_id uuid not null,
  student_id uuid not null,
  class_id uuid not null,
  media_type text not null,
  storage_path text not null,
  mime_type text not null,
  duration_ms integer,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.mood_media'::regclass and contype = 'p') then
    alter table public.mood_media add constraint mood_media_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mood_media'::regclass and conname = 'mood_media_mood_student_class_fkey') then
    alter table public.mood_media
      add constraint mood_media_mood_student_class_fkey
      foreign key (mood_id, student_id, class_id)
      references public.daily_moods (id, student_id, class_id)
      on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mood_media'::regclass and conname = 'mood_media_storage_path_key') then
    alter table public.mood_media add constraint mood_media_storage_path_key unique (storage_path);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mood_media'::regclass and conname = 'mood_media_mood_media_type_key') then
    alter table public.mood_media add constraint mood_media_mood_media_type_key unique (mood_id, media_type);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mood_media'::regclass and conname = 'mood_media_media_type_check') then
    alter table public.mood_media add constraint mood_media_media_type_check check (media_type in ('audio', 'image', 'drawing'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mood_media'::regclass and conname = 'mood_media_duration_ms_check') then
    alter table public.mood_media add constraint mood_media_duration_ms_check check (duration_ms is null or duration_ms >= 0);
  end if;
end
$$;

create index if not exists mood_media_student_class_idx on public.mood_media (student_id, class_id);
create index if not exists mood_media_mood_id_idx on public.mood_media (mood_id);

alter table public.mood_media enable row level security;
revoke all on table public.mood_media from public, anon, authenticated;
grant select, insert, update, delete on table public.mood_media to service_role;

commit;
