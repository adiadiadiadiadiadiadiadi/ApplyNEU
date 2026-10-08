-- ApplyNEU schema

CREATE TYPE public.application_status AS ENUM (
    'draft',
    'pending',
    'external',
    'external action needed',
    'applied',
    'interview',
    'offer',
    'rejected'
);

CREATE TYPE public.job_match_sensitivity AS ENUM (
    'low',
    'medium',
    'high'
);

CREATE TABLE public.job_applications (
    job_id uuid NOT NULL,
    user_id uuid NOT NULL,
    applied_at timestamp without time zone DEFAULT LOCALTIMESTAMP NOT NULL,
    application_id uuid DEFAULT gen_random_uuid() NOT NULL,
    status public.application_status DEFAULT 'draft'::public.application_status NOT NULL
);

CREATE TABLE public.jobs (
    job_id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    company text NOT NULL,
    description_hash text NOT NULL
);

-- Instructions depend only on the posting text, so they are keyed by its hash and shared by
-- every user and every job row with that description. '[]' means "extracted, nothing
-- required"; no row means "not extracted yet".
CREATE TABLE public.instruction_extractions (
    description_hash text NOT NULL,
    extraction_version smallint NOT NULL,
    instructions jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.job_matches (
    user_id uuid NOT NULL,
    job_id uuid NOT NULL,
    candidate_hash text NOT NULL,
    scoring_version smallint NOT NULL,
    match_score smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.preferences (
    user_id uuid CONSTRAINT preferences_user_id_not_null1 NOT NULL,
    job_types text[] DEFAULT '{}'::text[] NOT NULL,
    wait_for_approval boolean DEFAULT true NOT NULL,
    recent_jobs boolean DEFAULT true NOT NULL,
    job_match public.job_match_sensitivity DEFAULT 'low'::public.job_match_sensitivity NOT NULL,
    email_notifications boolean DEFAULT true NOT NULL,
    unpaid_roles boolean DEFAULT false NOT NULL,
    primary_resume_id uuid,
    interests text[] DEFAULT '{}'::text[] NOT NULL
);

CREATE TABLE public.profile (
    user_id uuid CONSTRAINT preferences_user_id_not_null NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    grad_year smallint NOT NULL
);

CREATE TABLE public.resumes (
    resume_id uuid NOT NULL,
    key text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    user_id uuid NOT NULL,
    file_name text NOT NULL,
    file_size_bytes integer NOT NULL,
    resume_text text NOT NULL,
    upload_complete boolean DEFAULT false,
    search_terms text[] DEFAULT '{}'::text[] NOT NULL,
    enrichment_status text DEFAULT 'none'::text NOT NULL,
    enrichment_retries integer DEFAULT 0 NOT NULL,
    CONSTRAINT resumes_enrichment_status_check CHECK (enrichment_status = ANY (ARRAY['none'::text, 'pending'::text, 'failed'::text, 'complete'::text]))
);

CREATE TABLE public.tasks (
    task_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT LOCALTIMESTAMP NOT NULL,
    completed boolean DEFAULT false,
    text text NOT NULL,
    description text,
    application_id uuid NOT NULL
);

CREATE TABLE public.users (
    user_id uuid NOT NULL
);

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_pkey PRIMARY KEY (application_id);

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_company_title_hash_uniq UNIQUE (company, title, description_hash);

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (job_id);

ALTER TABLE ONLY public.instruction_extractions
    ADD CONSTRAINT instruction_extractions_pkey PRIMARY KEY (description_hash, extraction_version);

ALTER TABLE ONLY public.job_matches
    ADD CONSTRAINT job_matches_pkey PRIMARY KEY (user_id, job_id);

ALTER TABLE ONLY public.job_matches
    ADD CONSTRAINT job_matches_score_range CHECK (match_score BETWEEN 0 AND 100);

ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT preferences_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.profile
    ADD CONSTRAINT profile_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_pkey PRIMARY KEY (resume_id);

-- Logically redundant given resumes_pkey, but a foreign key can only reference columns
-- carrying a unique constraint of exactly that shape, and preferences points at both.
ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_id_user_uniq UNIQUE (resume_id, user_id);

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (task_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);

CREATE INDEX idx_resumes_user_id ON public.resumes USING btree (user_id);

-- The primary key leads with user_id, so it cannot serve lookups by job_id alone; without
-- this, every job delete would scan the whole table to cascade.
CREATE INDEX idx_job_matches_job_id ON public.job_matches USING btree (job_id);

CREATE UNIQUE INDEX unique_user_job ON public.job_applications USING btree (job_id, user_id);

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(job_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.job_matches
    ADD CONSTRAINT job_matches_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(job_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.job_matches
    ADD CONSTRAINT job_matches_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

-- Carrying user_id into the reference is what keeps a user's primary pointed at their own
-- resume: preferences.user_id is the primary key, so the two user ids have to agree.
--
-- The column list on SET NULL is required, not decoration: a bare SET NULL nulls every
-- referencing column, and user_id is this table's NOT NULL primary key, so deleting a
-- resume someone had chosen would fail outright instead of clearing their pointer.
ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT preferences_primary_resume_fkey FOREIGN KEY (primary_resume_id, user_id) REFERENCES public.resumes(resume_id, user_id) ON DELETE SET NULL (primary_resume_id);

ALTER TABLE ONLY public.profile
    ADD CONSTRAINT profile_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.job_applications(application_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

-- Deleting a user in Supabase Auth now cascades through profile, preferences, resumes,
-- tasks, job_applications and job_matches, which all cascade off public.users. Without this the rows would orphan silently.
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_user_id_auth_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruction_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Give every new signup their starter rows: the users record every other table points
-- at, a profile from the signup form values, and a preferences row so the defaults apply.
--
-- This runs in the database rather than the backend because Supabase's auth service
-- creates the auth.users row, not our API -- so the API can only react afterwards via a
-- second HTTP call, which needs a token the browser does not have yet during signup.
-- Doing it here means the auth user and the app rows are created in one transaction and
-- cannot disagree.
--
-- security definer: the auth service inserts as a restricted role that cannot write to
-- public; the function runs as its owner (postgres) instead. search_path is pinned as the
-- standard hardening for definer functions.
--
-- graduation_year arrives as a string from the signup form. It is guarded rather than
-- cast directly: a bad value would raise inside the trigger and fail the whole signup.
CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$
BEGIN
    INSERT INTO public.users (user_id) VALUES (new.id)
        ON CONFLICT DO NOTHING;

    INSERT INTO public.profile (user_id, first_name, last_name, grad_year)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data ->> 'first_name', ''),
        COALESCE(new.raw_user_meta_data ->> 'last_name', ''),
        CASE
            WHEN new.raw_user_meta_data ->> 'graduation_year' ~ '^[0-9]+$'
            THEN (new.raw_user_meta_data ->> 'graduation_year')::smallint
            ELSE 0
        END
    )
        ON CONFLICT DO NOTHING;

    INSERT INTO public.preferences (user_id) VALUES (new.id)
        ON CONFLICT DO NOTHING;

    RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
