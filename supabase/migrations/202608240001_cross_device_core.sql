begin;

create extension if not exists pgcrypto;

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  teacher_code text not null unique,
  password_hash text not null,
  recovery_hash text not null,
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  name text not null,
  class_code text not null unique,
  feature_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.teacher_class_memberships (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  primary key (teacher_id, class_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  class_id uuid not null references public.classes(id) on delete restrict,
  name text not null,
  avatar text not null default '🌱',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, class_id)
);

create table public.student_access_credentials (
  student_id uuid primary key references public.students(id) on delete cascade,
  student_code text not null unique,
  pin_hash text not null,
  qr_token_hash text not null unique,
  qr_active boolean not null default true,
  token_version integer not null default 1 check (token_version > 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.daily_moods (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null,
  emoji_a text not null,
  emoji_b text not null,
  note text not null default '',
  drawing_url text,
  audio_url text,
  privacy_level text not null check (privacy_level in ('class_share', 'teacher_private', 'self_only')),
  activity_date date not null default current_date,
  created_at timestamptz not null default now(),
  foreign key (student_id, class_id) references public.students(id, class_id) on delete cascade
);

create table public.discoveries (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  privacy_level text not null check (privacy_level in ('class_share', 'teacher_private', 'self_only')),
  teacher_approved boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (student_id, class_id) references public.students(id, class_id) on delete cascade
);

create table public.personal_treasures (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  privacy_level text not null check (privacy_level in ('class_share', 'teacher_private', 'self_only')),
  teacher_approved boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (student_id, class_id) references public.students(id, class_id) on delete cascade
);

create table public.nature_cards (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  class_id uuid not null references public.classes(id) on delete cascade,
  sender_student_id uuid not null,
  recipient_student_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  class_share_requested boolean not null default false,
  teacher_approved boolean not null default false,
  created_at timestamptz not null default now(),
  check (sender_student_id <> recipient_student_id),
  foreign key (sender_student_id, class_id) references public.students(id, class_id) on delete cascade,
  foreign key (recipient_student_id, class_id) references public.students(id, class_id) on delete cascade
);

create table public.daily_friend_cards (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  class_id uuid not null references public.classes(id) on delete cascade,
  sender_student_id uuid not null,
  recipient_student_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  activity_date date not null default current_date,
  created_at timestamptz not null default now(),
  check (sender_student_id <> recipient_student_id),
  foreign key (sender_student_id, class_id) references public.students(id, class_id) on delete cascade,
  foreign key (recipient_student_id, class_id) references public.students(id, class_id) on delete cascade
);

create table public.teacher_feedback (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (student_id, class_id) references public.students(id, class_id) on delete cascade,
  foreign key (teacher_id, class_id) references public.teacher_class_memberships(teacher_id, class_id) on delete cascade
);

create table public.teacher_discoveries (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  teacher_id uuid not null,
  class_id uuid not null references public.classes(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (teacher_id, class_id) references public.teacher_class_memberships(teacher_id, class_id) on delete cascade
);

create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  class_id uuid not null references public.classes(id) on delete cascade,
  owner_student_id uuid,
  item_type text not null check (item_type in ('nature_card', 'discovery', 'personal_treasure', 'teacher_discovery')),
  source_external_id text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (external_id, class_id),
  unique (item_type, source_external_id),
  foreign key (owner_student_id, class_id) references public.students(id, class_id) on delete cascade
);

create table public.gallery_reactions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  gallery_item_id text not null,
  student_id uuid not null,
  reaction_type text not null default 'heart' check (reaction_type = 'heart'),
  created_at timestamptz not null default now(),
  unique (student_id, gallery_item_id, reaction_type),
  foreign key (student_id, class_id) references public.students(id, class_id) on delete cascade,
  foreign key (gallery_item_id, class_id) references public.gallery_items(external_id, class_id) on delete cascade
);

alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.teacher_class_memberships enable row level security;
alter table public.students enable row level security;
alter table public.student_access_credentials enable row level security;
alter table public.daily_moods enable row level security;
alter table public.discoveries enable row level security;
alter table public.personal_treasures enable row level security;
alter table public.nature_cards enable row level security;
alter table public.daily_friend_cards enable row level security;
alter table public.teacher_feedback enable row level security;
alter table public.teacher_discoveries enable row level security;
alter table public.gallery_items enable row level security;
alter table public.gallery_reactions enable row level security;

revoke all on table
  public.teachers,
  public.classes,
  public.teacher_class_memberships,
  public.students,
  public.student_access_credentials,
  public.daily_moods,
  public.discoveries,
  public.personal_treasures,
  public.nature_cards,
  public.daily_friend_cards,
  public.teacher_feedback,
  public.teacher_discoveries,
  public.gallery_items,
  public.gallery_reactions
from public, anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on table
  public.teachers,
  public.classes,
  public.teacher_class_memberships,
  public.students,
  public.student_access_credentials,
  public.daily_moods,
  public.discoveries,
  public.personal_treasures,
  public.nature_cards,
  public.daily_friend_cards,
  public.teacher_feedback,
  public.teacher_discoveries,
  public.gallery_items,
  public.gallery_reactions
to service_role;

commit;
