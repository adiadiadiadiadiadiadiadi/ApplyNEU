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
    company text NOT NULL
);

CREATE TABLE public.preferences (
    user_id uuid CONSTRAINT preferences_user_id_not_null1 NOT NULL,
    job_types text[] DEFAULT '{}'::text[] NOT NULL,
    wait_for_approval boolean DEFAULT true NOT NULL,
    recent_jobs boolean DEFAULT true NOT NULL,
    job_match public.job_match_sensitivity DEFAULT 'low'::public.job_match_sensitivity NOT NULL,
    email_notifications boolean DEFAULT true NOT NULL,
    unpaid_roles boolean DEFAULT false NOT NULL
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
    short_resume jsonb,
    upload_complete boolean DEFAULT false,
    search_terms text[] DEFAULT '{}'::text[] NOT NULL,
    interests text[] DEFAULT '{}'::text[] NOT NULL
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
    ADD CONSTRAINT jobs_company_title_uniq UNIQUE (company, title);

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (job_id);

ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT preferences_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.profile
    ADD CONSTRAINT profile_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_pkey PRIMARY KEY (resume_id);

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (task_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);

CREATE INDEX idx_resumes_user_id ON public.resumes USING btree (user_id);

CREATE UNIQUE INDEX unique_user_job ON public.job_applications USING btree (job_id, user_id);

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(job_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profile
    ADD CONSTRAINT profile_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.job_applications(application_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

-- Deleting a user in Supabase Auth now cascades through profile, preferences, resumes, 
-- tasks and job_applications, which all cascade off public.users. Without this the rows would orphan silently.
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_user_id_auth_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
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
