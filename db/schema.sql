--
-- Scribe schema extract
-- Source: db_cluster-01-12-2025@09-09-50.backup (pg_dumpall cluster dump)
-- Schemas: public, prod (Supabase auth/storage/realtime/etc stripped)
-- Data: stripped (DDL only)
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;
--
-- Name: pg_net; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;


--
-- Name: pgsodium; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgsodium WITH SCHEMA pgsodium;


--
-- Name: prod; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA prod;


ALTER SCHEMA prod OWNER TO postgres;

--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: pgjwt; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: agent; Type: TYPE; Schema: prod; Owner: postgres
--

CREATE TYPE prod.agent AS ENUM (
    'general',
    'syllabus',
    'learn',
    'homework',
    'review',
    'figure',
    'summary',
    'question',
    'content',
    'grade',
    'analyze',
    'report'
);


ALTER TYPE prod.agent OWNER TO postgres;

--
-- Name: TYPE agent; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON TYPE prod.agent IS 'openai agents defined';


--
-- Name: agent2; Type: TYPE; Schema: prod; Owner: postgres
--

CREATE TYPE prod.agent2 AS ENUM (
    'general',
    'learn',
    'content',
    'think'
);


ALTER TYPE prod.agent2 OWNER TO postgres;

--
-- Name: TYPE agent2; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON TYPE prod.agent2 IS '2nd iteration of agents';


--
-- Name: chat_type; Type: TYPE; Schema: prod; Owner: postgres
--

CREATE TYPE prod.chat_type AS ENUM (
    'homework-student',
    'homework-professor',
    'method',
    'generate',
    'general-student',
    'general-teacher',
    'concept',
    'review',
    'other',
    'present'
);


ALTER TYPE prod.chat_type OWNER TO postgres;

--
-- Name: chat_type_2; Type: TYPE; Schema: prod; Owner: postgres
--

CREATE TYPE prod.chat_type_2 AS ENUM (
    'student',
    'professor',
    'learn',
    'homework',
    'test',
    'grade',
    'figure',
    'summary',
    'question'
);


ALTER TYPE prod.chat_type_2 OWNER TO postgres;

--
-- Name: TYPE chat_type_2; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON TYPE prod.chat_type_2 IS 'Chat type revised';


--
-- Name: content_type; Type: TYPE; Schema: prod; Owner: postgres
--

CREATE TYPE prod.content_type AS ENUM (
    'lecture',
    'textbook',
    'homework',
    'practice',
    'syllabus',
    'rubric',
    'other'
);


ALTER TYPE prod.content_type OWNER TO postgres;

--
-- Name: TYPE content_type; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON TYPE prod.content_type IS 'for what type it is, lecture, textbook, or homework';


--
-- Name: file_aspect_ratio; Type: TYPE; Schema: prod; Owner: postgres
--

CREATE TYPE prod.file_aspect_ratio AS ENUM (
    'square',
    'landscape',
    'portrait',
    'default'
);


ALTER TYPE prod.file_aspect_ratio OWNER TO postgres;

--
-- Name: file_type; Type: TYPE; Schema: prod; Owner: postgres
--

CREATE TYPE prod.file_type AS ENUM (
    'audio',
    'video',
    'other',
    'image',
    'pdf'
);


ALTER TYPE prod.file_type OWNER TO postgres;

--
-- Name: TYPE file_type; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON TYPE prod.file_type IS 'for personal, audio, video, image, or pdf';


--
-- Name: generation_status; Type: TYPE; Schema: prod; Owner: postgres
--

CREATE TYPE prod.generation_status AS ENUM (
    'idle',
    'error',
    'complete',
    'generating'
);


ALTER TYPE prod.generation_status OWNER TO postgres;

--
-- Name: generation_type; Type: TYPE; Schema: prod; Owner: postgres
--

CREATE TYPE prod.generation_type AS ENUM (
    'problem',
    'summary',
    'chat'
);


ALTER TYPE prod.generation_type OWNER TO postgres;

--
-- Name: parse_status; Type: TYPE; Schema: prod; Owner: postgres
--

CREATE TYPE prod.parse_status AS ENUM (
    'extracting',
    'uploading',
    'compressing',
    'processing',
    'parsing',
    'complete',
    'idle',
    'error'
);


ALTER TYPE prod.parse_status OWNER TO postgres;

--
-- Name: topic_type; Type: TYPE; Schema: prod; Owner: postgres
--

CREATE TYPE prod.topic_type AS ENUM (
    'group',
    'term',
    'problem',
    'algorithm'
);


ALTER TYPE prod.topic_type OWNER TO postgres;

--
-- Name: question_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.question_type AS ENUM (
    'conceptual',
    'computational',
    'multi-part'
);


ALTER TYPE public.question_type OWNER TO postgres;

--
-- Name: topic_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.topic_type AS ENUM (
    'group',
    'term',
    'problem',
    'algorithm'
);


ALTER TYPE public.topic_type OWNER TO postgres;

--
-- Name: TYPE topic_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TYPE public.topic_type IS 'for each of the nodes';


--
-- Name: handle_homework_complete(); Type: FUNCTION; Schema: prod; Owner: postgres
--

CREATE FUNCTION prod.handle_homework_complete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    json_payload JSONB;
    headers JSONB;
    service_key TEXT;
BEGIN
    -- Check if the parse_status changed to 'complete'
    IF NEW.parse_status = 'complete' AND OLD.parse_status IS DISTINCT FROM 'complete' THEN

        -- Fetch the service role key securely from the vault
        SELECT decrypted_secret 
        INTO service_key
        FROM vault.decrypted_secrets
        WHERE name = 'service_role_key';

        -- Construct headers including the service role key for authorization
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
        );

        -- Build the JSON payload
        json_payload := jsonb_build_object(
            'evaluation_id', NEW.id,
            'type', 'homework'
        );

        -- Call the 'evaluate' edge function
        PERFORM net.http_post(
            'https://hmdqtnywfebxjugxzlvc.supabase.co/functions/v1/evaluate',
            json_payload,
            '{}'::jsonb, -- Default options
            headers,
            2000  -- Timeout in milliseconds
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION prod.handle_homework_complete() OWNER TO postgres;

--
-- Name: handle_lecture_complete(); Type: FUNCTION; Schema: prod; Owner: postgres
--

CREATE FUNCTION prod.handle_lecture_complete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    json_payload JSONB;
    headers JSONB;
    service_key TEXT;
BEGIN
    -- Check if the parse_status changed to 'complete'
    IF NEW.parse_status = 'complete' AND OLD.parse_status IS DISTINCT FROM 'complete' THEN

        -- Fetch the service role key securely from the vault
        SELECT decrypted_secret 
        INTO service_key
        FROM vault.decrypted_secrets
        WHERE name = 'service_role_key';

        -- Construct headers including the service role key for authorization
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
        );

        -- Build the JSON payload
        json_payload := jsonb_build_object(
            'evaluation_id', NEW.id,
            'type', 'lecture'
        );

        -- Call the 'evaluate' edge function
        PERFORM net.http_post(
            'https://hmdqtnywfebxjugxzlvc.supabase.co/functions/v1/evaluate',
            json_payload,
            '{}'::jsonb, -- Default options
            headers,
            2000  -- Timeout in milliseconds
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION prod.handle_lecture_complete() OWNER TO postgres;

--
-- Name: handle_message_complete(); Type: FUNCTION; Schema: prod; Owner: postgres
--

CREATE FUNCTION prod.handle_message_complete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    json_payload JSONB;
    chat_payload JSONB;
    headers JSONB;
    service_key TEXT;
    message_count INT;
    chat_id UUID;
BEGIN
    -- Check if the generation_status changed to 'complete'
    IF NEW.generation_status = 'complete' AND OLD.generation_status IS DISTINCT FROM 'complete' THEN

        -- Fetch the service role key securely from the vault
        SELECT decrypted_secret 
        INTO service_key
        FROM vault.decrypted_secrets
        WHERE name = 'service_role_key';

        -- Construct headers including the service role key for authorization
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
        );

        -- Fetch the chat ID
        SELECT chat INTO chat_id FROM prod.messages WHERE id = NEW.id;

        -- Check if this is the first message in the chat
        SELECT COUNT(*) INTO message_count FROM prod.messages WHERE chat = chat_id;

        -- Build the JSON payload for the message evaluation
        json_payload := jsonb_build_object(
            'evaluation_id', NEW.id,
            'type', 'message'
        );

        -- Call the 'evaluate' edge function
        PERFORM net.http_post(
            'https://hmdqtnywfebxjugxzlvc.supabase.co/functions/v1/evaluate',
            json_payload,
            '{}'::jsonb, -- Default options
            headers,
            2000  -- Timeout in milliseconds
        );

        -- If this is the first message in the chat, call the chat evaluation endpoint
        IF message_count = 1 THEN
            chat_payload := jsonb_build_object(
                'evaluation_id', chat_id,
                'type', 'chat'
            );

            PERFORM net.http_post(
                'https://hmdqtnywfebxjugxzlvc.supabase.co/functions/v1/evaluate',
                chat_payload,
                '{}'::jsonb, -- Default options
                headers,
                2000  -- Timeout in milliseconds
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION prod.handle_message_complete() OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: prod; Owner: postgres
--

CREATE FUNCTION prod.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_old_id text;
BEGIN
  -- Extract the old_id from the raw_user_meta_data if present
  v_old_id := NEW.raw_user_meta_data->>'old_id';

  IF v_old_id IS NOT NULL AND v_old_id <> '' THEN
    -- If old_id exists, update the existing profile
    UPDATE prod.profiles
       SET id         = NEW.id,
           first_name = COALESCE(NEW.raw_user_meta_data->>'first_name', 'John'),
           last_name  = COALESCE(NEW.raw_user_meta_data->>'last_name',  'Doe'),
           classes    = COALESCE(
                           (
                             SELECT array_agg(elem::uuid)
                             FROM jsonb_array_elements_text(NEW.raw_user_meta_data -> 'classes') AS elem
                           ),
                           ARRAY[]::uuid[]
                         ),
           email      = COALESCE(NEW.raw_user_meta_data->>'email', 'pete@purdue.edu')
     WHERE id = v_old_id::uuid;
  ELSE
    -- Otherwise, insert a new profile with the user’s new ID
    INSERT INTO prod.profiles (
      id,
      first_name,
      last_name,
      classes,
      email
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'John'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'Doe'),
      COALESCE(
        (
          SELECT array_agg(elem::uuid)
          FROM jsonb_array_elements_text(NEW.raw_user_meta_data -> 'classes') AS elem
        ),
        ARRAY[]::uuid[]
      ),
      COALESCE(NEW.raw_user_meta_data->>'email', 'pete@purdue.edu')
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION prod.handle_new_user() OWNER TO postgres;

--
-- Name: handle_textbook_complete(); Type: FUNCTION; Schema: prod; Owner: postgres
--

CREATE FUNCTION prod.handle_textbook_complete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    json_payload JSONB;
    headers JSONB;
    service_key TEXT;
BEGIN
    -- Check if the parse_status changed to 'complete'
    IF NEW.parse_status = 'complete' AND OLD.parse_status IS DISTINCT FROM 'complete' THEN

        -- Fetch the service role key securely from the vault
        SELECT decrypted_secret 
        INTO service_key
        FROM vault.decrypted_secrets
        WHERE name = 'service_role_key';

        -- Construct headers including the service role key for authorization
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
        );

        -- Build the JSON payload
        json_payload := jsonb_build_object(
            'evaluation_id', NEW.id,
            'type', 'textbook'
        );

        -- Call the 'evaluate' edge function
        PERFORM net.http_post(
            'https://hmdqtnywfebxjugxzlvc.supabase.co/functions/v1/evaluate',
            json_payload,
            '{}'::jsonb, -- Default options
            headers,
            2000  -- Timeout in milliseconds
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION prod.handle_textbook_complete() OWNER TO postgres;

--
-- Name: send_feedback(); Type: FUNCTION; Schema: prod; Owner: postgres
--

CREATE FUNCTION prod.send_feedback() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$declare
  service_key text;
  headers     jsonb;
  payload     jsonb;
begin
  -- fetch the service-role key
  select decrypted_secret
    into service_key
    from vault.decrypted_secrets
   where name = 'service_role_key';

  -- build the HTTP headers
  headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer ' || service_key
  );

  -- build the payload, coalescing NULLs to empty strings
  payload := jsonb_build_object(
    'positive', coalesce(new.positive::text, ''),
    'negative', coalesce(new.negative::text, ''),
    'feature',  coalesce(new.feature::text,  '')
  );

  -- invoke your edge function (adjust the URL to match your project ref)
  perform net.http_post(
    'https://hmdqtnywfebxjugxzlvc.supabase.co/functions/v1/send-feedback',
    payload,
    '{}'::jsonb,
    headers,
    2000
  );

  return new;
end;$$;


ALTER FUNCTION prod.send_feedback() OWNER TO postgres;

--
-- Name: insert_into_embeddings(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.insert_into_embeddings() RETURNS trigger
    LANGUAGE plpgsql
    AS $$DECLARE
  doc_type TEXT;
  id UUID;
  interval FLOAT4;
BEGIN
  -- Extract 'type', 'id', and 'interval' from the JSON 'metadata' column of the new document
  doc_type := (NEW.metadata->>'type')::TEXT;
  id := (NEW.metadata->>'id')::UUID;
  interval := (NEW.metadata->>'interval')::FLOAT4;

  -- Insert the required data into the corresponding embeddings table based on 'type'
  IF doc_type = 'lecture' THEN
    INSERT INTO embeddings_lecture (embedding, content, timestamp, lecture)
    VALUES (
      NEW.embedding,  -- Embedding comes from the 'documents' table
      NEW.content,  -- Content comes from the 'documents' table
      interval,  -- Parsed timestamp from metadata
      id  -- Parsed lecture UUID from metadata
    );
  ELSIF doc_type = 'slide' THEN
    INSERT INTO embeddings_slide (embedding, content, page, slide)
    VALUES (
      NEW.embedding,  -- Embedding comes from the 'documents' table
      NEW.content,  -- Content comes from the 'documents' table
      interval::INT,  -- Parsed interval from metadata, cast to integer
      id  -- Parsed lecture UUID from metadata
    );
  ELSIF doc_type = 'textbook' THEN
    INSERT INTO embeddings_textbook (embedding, content, page, textbook)
    VALUES (
      NEW.embedding,  -- Embedding comes from the 'documents' table
      NEW.content,  -- Content comes from the 'documents' table
      interval::INT,  -- Parsed interval from metadata, cast to integer
      id  -- Parsed lecture UUID from metadata
    );
  END IF;

  RETURN NEW;
END;$$;


ALTER FUNCTION public.insert_into_embeddings() OWNER TO postgres;

--
-- Name: match_documents(public.vector, double precision, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.match_documents(query_embedding public.vector, match_threshold double precision, match_count integer) RETURNS TABLE(id uuid, content text, similarity double precision)
    LANGUAGE sql STABLE
    AS $$
  select
    documents.id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where documents.embedding <=> query_embedding < 1 - match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;


ALTER FUNCTION public.match_documents(query_embedding public.vector, match_threshold double precision, match_count integer) OWNER TO postgres;

--
-- Name: match_embeddings_lecture(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.match_embeddings_lecture(query_embedding public.vector, match_count integer DEFAULT NULL::integer, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id uuid, content text, metadata jsonb, embedding jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    json_build_object('document_id', id)::jsonb as metadata,
    (embedding::text)::jsonb as embedding,
    1 - (embeddings_lecture.embedding <=> query_embedding) as similarity
  from embeddings_lecture
  order by embeddings_lecture.embedding <=> query_embedding
  limit match_count;
end;$$;


ALTER FUNCTION public.match_embeddings_lecture(query_embedding public.vector, match_count integer, filter jsonb) OWNER TO postgres;

--
-- Name: match_embeddings_slide(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.match_embeddings_slide(query_embedding public.vector, match_count integer DEFAULT NULL::integer, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id uuid, content text, metadata jsonb, embedding jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    json_build_object('document_id', id)::jsonb as metadata,
    (embedding::text)::jsonb as embedding,
    1 - (embeddings_slide.embedding <=> query_embedding) as similarity
  from embeddings_slide
  order by embeddings_slide.embedding <=> query_embedding
  limit match_count;
end;
$$;


ALTER FUNCTION public.match_embeddings_slide(query_embedding public.vector, match_count integer, filter jsonb) OWNER TO postgres;

--
-- Name: match_embeddings_textbook(public.vector, integer, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.match_embeddings_textbook(query_embedding public.vector, match_count integer DEFAULT NULL::integer, filter jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id uuid, content text, metadata jsonb, embedding jsonb, similarity double precision)
    LANGUAGE plpgsql
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    json_build_object('document_id', id)::jsonb as metadata,
    (embedding::text)::jsonb as embedding,
    1 - (embeddings_textbook.embedding <=> query_embedding) as similarity
  from embeddings_textbook
  order by embeddings_textbook.embedding <=> query_embedding
  limit match_count;
end;
$$;


ALTER FUNCTION public.match_embeddings_textbook(query_embedding public.vector, match_count integer, filter jsonb) OWNER TO postgres;

--
-- Name: chats; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.chats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    profile uuid,
    class uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    type prod.chat_type DEFAULT 'general-student'::prod.chat_type NOT NULL,
    teacher boolean DEFAULT false NOT NULL,
    response_url text DEFAULT ''::text NOT NULL,
    rating real,
    trace text,
    chat_type prod.chat_type_2 DEFAULT 'student'::prod.chat_type_2 NOT NULL,
    used_files uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    used_documents uuid[] DEFAULT '{}'::uuid[] NOT NULL
);


ALTER TABLE prod.chats OWNER TO postgres;

--
-- Name: COLUMN chats.type; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.chats.type IS 'type of chat';


--
-- Name: COLUMN chats.teacher; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.chats.teacher IS 'if this is a teacher chat';


--
-- Name: COLUMN chats.response_url; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.chats.response_url IS 'used for the first message in a chat';


--
-- Name: COLUMN chats.rating; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.chats.rating IS 'rating of the chat';


--
-- Name: COLUMN chats.trace; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.chats.trace IS 'trace id openai';


--
-- Name: COLUMN chats.chat_type; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.chats.chat_type IS 'chat type revised';


--
-- Name: classes; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
    title text,
    class_code text,
    course_link text,
    brightspace_course_id integer,
    brightspace_course_descriptor text,
    course_description text,
    deleted boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    download boolean DEFAULT true NOT NULL,
    privacy boolean DEFAULT false NOT NULL,
    download_time time without time zone DEFAULT now() NOT NULL,
    lecture_prompt text DEFAULT ''::text NOT NULL,
    textbook_prompt text DEFAULT ''::text NOT NULL,
    homework_prompt text DEFAULT ''::text NOT NULL,
    students text[] DEFAULT '{}'::text[] NOT NULL,
    professors text[] DEFAULT '{}'::text[] NOT NULL,
    lecture_enabled boolean DEFAULT true NOT NULL,
    textbook_enabled boolean DEFAULT true NOT NULL,
    homework_enabled boolean DEFAULT true NOT NULL,
    saved boolean DEFAULT false NOT NULL,
    learn_mode_enabled boolean DEFAULT true NOT NULL,
    homework_mode_enabled boolean DEFAULT true NOT NULL,
    test_prep_mode_enabled boolean DEFAULT true NOT NULL,
    present_mode_enabled boolean DEFAULT false NOT NULL,
    files_enabled boolean DEFAULT false NOT NULL,
    root_folder text,
    video_enabled boolean DEFAULT false NOT NULL,
    syllabus uuid
);


ALTER TABLE prod.classes OWNER TO postgres;

--
-- Name: COLUMN classes.active; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.active IS 'whether we should show in supabase';


--
-- Name: COLUMN classes.updated_at; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.updated_at IS 'when the content was last downloaded';


--
-- Name: COLUMN classes.download; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.download IS 'whether we should keep daily downloading';


--
-- Name: COLUMN classes.privacy; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.privacy IS 'whether privacy mode is on (we use open source models instead)';


--
-- Name: COLUMN classes.download_time; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.download_time IS 'when to download daily';


--
-- Name: COLUMN classes.students; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.students IS 'emails of students allowed for class';


--
-- Name: COLUMN classes.professors; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.professors IS 'professors allowed for class';


--
-- Name: COLUMN classes.saved; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.saved IS 'in onboarding phase';


--
-- Name: COLUMN classes.learn_mode_enabled; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.learn_mode_enabled IS 'learn mode chat';


--
-- Name: COLUMN classes.homework_mode_enabled; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.homework_mode_enabled IS 'homework mode chat';


--
-- Name: COLUMN classes.present_mode_enabled; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.present_mode_enabled IS 'com class, present mode';


--
-- Name: COLUMN classes.files_enabled; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.files_enabled IS 'if students can upload files';


--
-- Name: COLUMN classes.root_folder; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.root_folder IS 'where we have all of their files in onedrive';


--
-- Name: COLUMN classes.video_enabled; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.video_enabled IS 'if they can use the video mode';


--
-- Name: COLUMN classes.syllabus; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.classes.syllabus IS 'file id of the syllabus';


--
-- Name: codes; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    code text NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    class uuid NOT NULL
);


ALTER TABLE prod.codes OWNER TO postgres;

--
-- Name: TABLE codes; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON TABLE prod.codes IS 'for enabling certain scopes of classes';


--
-- Name: contact; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.contact (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    message text DEFAULT ''::text NOT NULL
);


ALTER TABLE prod.contact OWNER TO postgres;

--
-- Name: documents; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    page integer NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    text text DEFAULT ''::text NOT NULL,
    file uuid,
    start_time real,
    end_time real,
    size jsonb DEFAULT '"{\"h\": 100, \"w\": 100, \"x\": 0, \"y\": 0}"'::jsonb NOT NULL,
    exercise_number integer,
    problem_number integer,
    problem_part_number integer,
    chapter_number integer,
    class uuid DEFAULT 'c770c9bb-4de1-44be-aacb-b4bea3efbacf'::uuid NOT NULL,
    extension text DEFAULT 'png'::text NOT NULL
);


ALTER TABLE prod.documents OWNER TO postgres;

--
-- Name: TABLE documents; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON TABLE prod.documents IS 'For each individual slide document';


--
-- Name: COLUMN documents.processed; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.documents.processed IS 'if it has been processed by ''parse-lecture'' or ''parse-textbook''';


--
-- Name: COLUMN documents.text; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.documents.text IS 'the textual description of pdf if contained';


--
-- Name: COLUMN documents.size; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.documents.size IS 'for images, w,h,x, and y';


--
-- Name: COLUMN documents.extension; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.documents.extension IS 'how the file is stored in supabase';


--
-- Name: feedback; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    positive text DEFAULT ''::text NOT NULL,
    negative text DEFAULT ''::text NOT NULL,
    feature text DEFAULT ''::text NOT NULL
);


ALTER TABLE prod.feedback OWNER TO postgres;

--
-- Name: figures; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.figures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    message uuid,
    code text DEFAULT ''::text NOT NULL,
    prompt text DEFAULT ''::text NOT NULL,
    response_url text DEFAULT ''::text NOT NULL,
    generation_status prod.generation_status DEFAULT 'idle'::prod.generation_status NOT NULL,
    generation_error text DEFAULT ''::text NOT NULL,
    last_generation_attempt timestamp with time zone,
    lecture_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    chapter_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    homework_exercise_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    chapter_exercise_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    summary uuid,
    question uuid,
    file_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    "references" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    class uuid DEFAULT 'df6339ac-2e6a-48ae-81cd-8ead52d95ffc'::uuid NOT NULL
);


ALTER TABLE prod.figures OWNER TO postgres;

--
-- Name: TABLE figures; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON TABLE prod.figures IS 'to show math/cs figures created by the model';


--
-- Name: COLUMN figures.prompt; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.figures.prompt IS 'what is used to create the figure';


--
-- Name: COLUMN figures.summary; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.figures.summary IS 'id of summary if associated with figure';


--
-- Name: COLUMN figures.question; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.figures.question IS 'id of question if associated with figure';


--
-- Name: COLUMN figures.title; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.figures.title IS 'title of the figure';


--
-- Name: files; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    class uuid DEFAULT gen_random_uuid() NOT NULL,
    profile uuid,
    type prod.file_type NOT NULL,
    length integer DEFAULT 0 NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    parse_status prod.parse_status DEFAULT 'idle'::prod.parse_status NOT NULL,
    parse_error text DEFAULT ''::text NOT NULL,
    last_parse_attempt timestamp with time zone,
    response_url text DEFAULT ''::text NOT NULL,
    expires timestamp with time zone DEFAULT ((now() AT TIME ZONE 'utc'::text) + '48:00:00'::interval),
    file_number integer DEFAULT 0 NOT NULL,
    file_names text[] DEFAULT '{}'::text[] NOT NULL,
    file_size real DEFAULT '0'::real NOT NULL,
    active boolean DEFAULT true NOT NULL,
    content_type prod.content_type DEFAULT 'other'::prod.content_type NOT NULL,
    file_date date DEFAULT now(),
    additional_info text DEFAULT ''::text NOT NULL,
    extension text DEFAULT 'pdf'::text NOT NULL,
    compression_progress real DEFAULT '0'::real NOT NULL,
    upload_progress real DEFAULT '0'::real NOT NULL,
    extraction_progress real DEFAULT '0'::real NOT NULL,
    processing_progress real DEFAULT '0'::real NOT NULL,
    aspect_ratio prod.file_aspect_ratio DEFAULT 'default'::prod.file_aspect_ratio NOT NULL
);


ALTER TABLE prod.files OWNER TO postgres;

--
-- Name: TABLE files; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON TABLE prod.files IS 'for audio, video, and image personal files';


--
-- Name: COLUMN files.length; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.files.length IS 'for audio/video (in seconds)';


--
-- Name: COLUMN files.expires; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.files.expires IS 'when the file expires, and we no longer show it';


--
-- Name: COLUMN files.file_number; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.files.file_number IS 'file number for user (consistency with other components)';


--
-- Name: COLUMN files.file_names; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.files.file_names IS 'gemini file names';


--
-- Name: COLUMN files.content_type; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.files.content_type IS 'what is the content type of the file';


--
-- Name: COLUMN files.file_date; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.files.file_date IS 'when it is available/occurs';


--
-- Name: COLUMN files.extension; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.files.extension IS 'extension saved in supabase';


--
-- Name: COLUMN files.compression_progress; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.files.compression_progress IS 'float from 0 to 100 that represents compression progress (with ffmpeg)';


--
-- Name: COLUMN files.upload_progress; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.files.upload_progress IS 'number from 0 to 100 that shows upload progress,';


--
-- Name: COLUMN files.extraction_progress; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.files.extraction_progress IS 'number from 0-100 with the extraction progress';


--
-- Name: COLUMN files.processing_progress; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.files.processing_progress IS 'final phase of uploading, num from 0-100';


--
-- Name: COLUMN files.aspect_ratio; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.files.aspect_ratio IS 'size of file viewing';


--
-- Name: google; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.google (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    file uuid,
    document uuid,
    google_id text NOT NULL,
    expires_at timestamp with time zone,
    deleted boolean DEFAULT false NOT NULL,
    tokens integer DEFAULT 0 NOT NULL,
    chat uuid
);


ALTER TABLE prod.google OWNER TO postgres;

--
-- Name: TABLE google; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON TABLE prod.google IS 'for google files';


--
-- Name: COLUMN google.deleted; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.google.deleted IS 'if it has been deleted from google';


--
-- Name: COLUMN google.tokens; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.google.tokens IS 'how many tokens this file/cache takes up';


--
-- Name: grades; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.grades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    file uuid,
    rubric uuid,
    results text[] DEFAULT '{}'::text[] NOT NULL,
    feedback text[] DEFAULT '{}'::text[] NOT NULL,
    message uuid NOT NULL,
    generation_status prod.generation_status DEFAULT 'idle'::prod.generation_status NOT NULL,
    generation_error text DEFAULT ''::text NOT NULL,
    last_generation_attempt timestamp with time zone,
    figures uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    "references" jsonb[] DEFAULT '{}'::jsonb[] NOT NULL,
    title text DEFAULT ''::text NOT NULL
);


ALTER TABLE prod.grades OWNER TO postgres;

--
-- Name: TABLE grades; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON TABLE prod.grades IS 'for grading results';


--
-- Name: messages; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    question text DEFAULT ''::text NOT NULL,
    response text DEFAULT ''::text NOT NULL,
    "references" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    documents uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    chat uuid,
    generation_status prod.generation_status DEFAULT 'idle'::prod.generation_status NOT NULL,
    generation_error text DEFAULT ''::text NOT NULL,
    last_generation_attempt timestamp with time zone,
    bare_response text DEFAULT ''::text NOT NULL,
    bare_question text DEFAULT ''::text NOT NULL,
    profile uuid,
    files uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    status_text text DEFAULT ''::text NOT NULL,
    class uuid DEFAULT 'df6339ac-2e6a-48ae-81cd-8ead52d95ffc'::uuid NOT NULL,
    correct boolean DEFAULT true NOT NULL,
    incorrect_reason text DEFAULT ''::text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    start_agent prod.agent DEFAULT 'learn'::prod.agent NOT NULL,
    end_agent prod.agent DEFAULT 'learn'::prod.agent NOT NULL
);


ALTER TABLE prod.messages OWNER TO postgres;

--
-- Name: COLUMN messages.chat; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.messages.chat IS 'the chat the message is from';


--
-- Name: COLUMN messages.bare_response; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.messages.bare_response IS 'without removing any formatting';


--
-- Name: COLUMN messages.bare_question; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.messages.bare_question IS 'with added context';


--
-- Name: COLUMN messages.profile; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.messages.profile IS 'who sent message';


--
-- Name: COLUMN messages.status_text; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.messages.status_text IS 'while the LLM is thinking about what to do';


--
-- Name: COLUMN messages.correct; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.messages.correct IS 'quality assurance by the AI';


--
-- Name: COLUMN messages.start_agent; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.messages.start_agent IS 'what agent the message starts with';


--
-- Name: COLUMN messages.end_agent; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.messages.end_agent IS 'what agent the message ends with';


--
-- Name: objectives; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.objectives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class uuid DEFAULT gen_random_uuid() NOT NULL,
    title text DEFAULT '""'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    outcome uuid NOT NULL,
    message uuid
);


ALTER TABLE prod.objectives OWNER TO postgres;

--
-- Name: onedrive; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.onedrive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    provider_token text DEFAULT ''::text NOT NULL,
    refresh_token text DEFAULT ''::text NOT NULL,
    expires_at timestamp with time zone,
    active boolean DEFAULT true NOT NULL,
    profile uuid NOT NULL
);


ALTER TABLE prod.onedrive OWNER TO postgres;

--
-- Name: TABLE onedrive; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON TABLE prod.onedrive IS 'for microsoft onedrive access';


--
-- Name: outcomes; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.outcomes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    class uuid DEFAULT gen_random_uuid(),
    title text DEFAULT ''::text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted boolean DEFAULT false NOT NULL
);


ALTER TABLE prod.outcomes OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
    first_name text DEFAULT ''::text NOT NULL,
    last_name text DEFAULT ''::text NOT NULL,
    professor boolean DEFAULT false NOT NULL,
    admin boolean DEFAULT false NOT NULL,
    classes uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    email text DEFAULT ''::text NOT NULL
);


ALTER TABLE prod.profiles OWNER TO postgres;

--
-- Name: COLUMN profiles.professor; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.profiles.professor IS 'if they are professor';


--
-- Name: COLUMN profiles.admin; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.profiles.admin IS 'can see all classes';


--
-- Name: COLUMN profiles.classes; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.profiles.classes IS 'classes restricted to teaching/taking';


--
-- Name: questions; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    multi uuid,
    frq boolean DEFAULT false NOT NULL,
    message uuid,
    problem text DEFAULT ''::text NOT NULL,
    solution text DEFAULT ''::text NOT NULL,
    options text[] DEFAULT '{}'::text[] NOT NULL,
    answers text[] DEFAULT '{}'::text[] NOT NULL,
    prompt text DEFAULT ''::text NOT NULL,
    computational boolean DEFAULT false NOT NULL,
    explanations text[] DEFAULT '{}'::text[] NOT NULL,
    response_url text DEFAULT ''::text NOT NULL,
    generation_status prod.generation_status DEFAULT 'idle'::prod.generation_status NOT NULL,
    generation_error text DEFAULT ''::text NOT NULL,
    last_generation_attempt timestamp with time zone,
    lecture_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    chapter_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    homework_exercise_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    chapter_exercise_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    figures uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    file_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    "references" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    class uuid DEFAULT 'df6339ac-2e6a-48ae-81cd-8ead52d95ffc'::uuid NOT NULL
);


ALTER TABLE prod.questions OWNER TO postgres;

--
-- Name: COLUMN questions.computational; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.questions.computational IS 'or conceptual is default';


--
-- Name: COLUMN questions.title; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.questions.title IS 'the title of the question';


--
-- Name: reports; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    message uuid NOT NULL,
    generation_status prod.generation_status DEFAULT 'idle'::prod.generation_status NOT NULL,
    generation_error text DEFAULT ''::text NOT NULL,
    last_generation_attempt timestamp with time zone,
    figures uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    "references" jsonb[] DEFAULT '{}'::jsonb[] NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    class uuid NOT NULL
);


ALTER TABLE prod.reports OWNER TO postgres;

--
-- Name: TABLE reports; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON TABLE prod.reports IS 'For the teacher end';


--
-- Name: summaries; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    preamble text DEFAULT ''::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    conclusion text DEFAULT ''::text NOT NULL,
    message uuid,
    prompt text DEFAULT ''::text NOT NULL,
    response_url text DEFAULT ''::text NOT NULL,
    generation_status prod.generation_status DEFAULT 'idle'::prod.generation_status NOT NULL,
    generation_error text DEFAULT ''::text NOT NULL,
    last_generation_attempt timestamp with time zone,
    lecture_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    chapter_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    homework_exercise_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    chapter_exercise_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    figures uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    file_references uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    "references" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    class uuid DEFAULT 'df6339ac-2e6a-48ae-81cd-8ead52d95ffc'::uuid NOT NULL
);


ALTER TABLE prod.summaries OWNER TO postgres;

--
-- Name: COLUMN summaries.prompt; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.summaries.prompt IS 'what created the summary';


--
-- Name: COLUMN summaries.title; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.summaries.title IS 'the title of the summary';


--
-- Name: usage; Type: TABLE; Schema: prod; Owner: postgres
--

CREATE TABLE prod.usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    profile uuid,
    chat uuid,
    cached_input_tokens integer DEFAULT 0 NOT NULL,
    model text DEFAULT 'gemini-2.0-flash'::text NOT NULL,
    reasoning_tokens integer DEFAULT 0 NOT NULL
);


ALTER TABLE prod.usage OWNER TO postgres;

--
-- Name: TABLE usage; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON TABLE prod.usage IS 'used to track incoming and outgoing tokens, by user';


--
-- Name: COLUMN usage.chat; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.usage.chat IS 'chat usage';


--
-- Name: COLUMN usage.cached_input_tokens; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.usage.cached_input_tokens IS 'how many of input tokens are cached';


--
-- Name: COLUMN usage.reasoning_tokens; Type: COMMENT; Schema: prod; Owner: postgres
--

COMMENT ON COLUMN prod.usage.reasoning_tokens IS 'if the model used reasoning (these are not including output)';


--
-- Name: chapters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chapters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    textbook uuid DEFAULT gen_random_uuid() NOT NULL,
    chapter_number integer DEFAULT 0 NOT NULL,
    page_number integer DEFAULT 0 NOT NULL,
    exercise_page_number integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.chapters OWNER TO postgres;

--
-- Name: classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    class_code text DEFAULT ''::text NOT NULL,
    root_node uuid,
    course_link text,
    brightspace_course_id integer,
    brightspace_course_descriptor text,
    course_description text DEFAULT ''::text NOT NULL
);


ALTER TABLE public.classes OWNER TO postgres;

--
-- Name: COLUMN classes.root_node; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.classes.root_node IS 'which map to show for this class';


--
-- Name: COLUMN classes.course_link; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.classes.course_link IS 'link to course, if not on brightspace. Ex: https://www.math.purdue.edu/~yipn/421';


--
-- Name: COLUMN classes.brightspace_course_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.classes.brightspace_course_id IS 'The 7 digit id found on the link of the brightspace course URL, ex 1095465';


--
-- Name: COLUMN classes.brightspace_course_descriptor; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.classes.brightspace_course_descriptor IS 'A descriptor for the course, found on the grid view, ex WL.202510.CS24200.LE1.';


--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content text,
    metadata jsonb,
    embedding public.vector(768)
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: embeddings_lecture; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.embeddings_lecture (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    embedding public.vector NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    "timestamp" real DEFAULT '0'::real NOT NULL,
    lecture uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.embeddings_lecture OWNER TO postgres;

--
-- Name: embeddings_slide; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.embeddings_slide (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    embedding public.vector NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    page integer DEFAULT 0 NOT NULL,
    slide uuid DEFAULT gen_random_uuid() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.embeddings_slide OWNER TO postgres;

--
-- Name: embeddings_textbook; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.embeddings_textbook (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    embedding public.vector NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    page integer DEFAULT 0 NOT NULL,
    textbook uuid DEFAULT gen_random_uuid() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.embeddings_textbook OWNER TO postgres;

--
-- Name: homework; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.homework (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    homework_number integer DEFAULT 0 NOT NULL,
    class uuid DEFAULT gen_random_uuid() NOT NULL,
    title text DEFAULT ''::text NOT NULL
);


ALTER TABLE public.homework OWNER TO postgres;

--
-- Name: homework_problems; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.homework_problems (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    homework uuid DEFAULT gen_random_uuid() NOT NULL,
    textbook uuid,
    page_number integer,
    problem_number text,
    additional_info text
);


ALTER TABLE public.homework_problems OWNER TO postgres;

--
-- Name: lectures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lectures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    lecture_number integer DEFAULT 0 NOT NULL,
    class uuid DEFAULT auth.uid() NOT NULL
);


ALTER TABLE public.lectures OWNER TO postgres;

--
-- Name: practice_exams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.practice_exams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    slides uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    class uuid NOT NULL,
    professor boolean DEFAULT false NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    num_questions integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.practice_exams OWNER TO postgres;

--
-- Name: practice_questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.practice_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    question text DEFAULT ''::text NOT NULL,
    solution text DEFAULT ''::text NOT NULL,
    practice_exam uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.practice_questions OWNER TO postgres;

--
-- Name: queries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.queries (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    question text,
    answer text,
    class uuid
);


ALTER TABLE public.queries OWNER TO postgres;

--
-- Name: TABLE queries; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.queries IS 'question and answer responses';


--
-- Name: queries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.queries ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.queries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    question text DEFAULT ''::text NOT NULL,
    solution text DEFAULT ''::text NOT NULL,
    slide uuid,
    option_a text,
    option_b text,
    option_c text,
    option_d text,
    option_e text,
    explanation_a text,
    explanation_b text,
    explanation_c text,
    explanation_d text,
    explanation_e text,
    topic uuid
);


ALTER TABLE public.questions OWNER TO postgres;

--
-- Name: slides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.slides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    note_number integer DEFAULT 0 NOT NULL,
    class uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted boolean DEFAULT false NOT NULL
);


ALTER TABLE public.slides OWNER TO postgres;

--
-- Name: subchapters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subchapters (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    section_number integer DEFAULT 0 NOT NULL,
    page_number integer DEFAULT 0 NOT NULL,
    chapter uuid DEFAULT gen_random_uuid() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.subchapters OWNER TO postgres;

--
-- Name: summaries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    content text NOT NULL,
    slide uuid,
    topic uuid
);


ALTER TABLE public.summaries OWNER TO postgres;

--
-- Name: textbooks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.textbooks (
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    author text NOT NULL,
    pages integer NOT NULL,
    class uuid DEFAULT gen_random_uuid() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.textbooks OWNER TO postgres;

--
-- Name: COLUMN textbooks.pages; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.textbooks.pages IS 'what page to end on';


--
-- Name: topics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    map_parent uuid,
    title text DEFAULT ''::text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    class uuid DEFAULT gen_random_uuid() NOT NULL,
    lectures uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    map_id uuid NOT NULL,
    type public.topic_type DEFAULT 'term'::public.topic_type NOT NULL,
    visuals text[] DEFAULT '{}'::text[] NOT NULL,
    x real,
    y real
);


ALTER TABLE public.topics OWNER TO postgres;

--
-- Name: COLUMN topics.visuals; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.topics.visuals IS 'urls of figures';


--
-- Name: COLUMN topics.x; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.topics.x IS 'x position of the node';


--
-- Name: COLUMN topics.y; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.topics.y IS 'y position of the node';


--
-- Name: waitlist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.waitlist (
    email text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.waitlist OWNER TO postgres;

--
-- Name: queries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.queries_id_seq', 32, true);


--
-- Name: chats chats_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: codes codes_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.codes
    ADD CONSTRAINT codes_pkey PRIMARY KEY (id);


--
-- Name: contact contact_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.contact
    ADD CONSTRAINT contact_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: figures figures_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.figures
    ADD CONSTRAINT figures_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: google google_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.google
    ADD CONSTRAINT google_pkey PRIMARY KEY (id);


--
-- Name: grades grades_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.grades
    ADD CONSTRAINT grades_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: objectives objectives_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.objectives
    ADD CONSTRAINT objectives_pkey PRIMARY KEY (id);


--
-- Name: onedrive onedrive_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.onedrive
    ADD CONSTRAINT onedrive_pkey PRIMARY KEY (id);


--
-- Name: outcomes outcomes_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.outcomes
    ADD CONSTRAINT outcomes_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: summaries summaries_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.summaries
    ADD CONSTRAINT summaries_pkey PRIMARY KEY (id);


--
-- Name: usage usage_pkey; Type: CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.usage
    ADD CONSTRAINT usage_pkey PRIMARY KEY (id);


--
-- Name: chapters chapters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: embeddings_lecture embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.embeddings_lecture
    ADD CONSTRAINT embeddings_pkey PRIMARY KEY (id);


--
-- Name: embeddings_slide embeddings_slide_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.embeddings_slide
    ADD CONSTRAINT embeddings_slide_pkey PRIMARY KEY (id);


--
-- Name: embeddings_textbook embeddings_textbook_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.embeddings_textbook
    ADD CONSTRAINT embeddings_textbook_pkey PRIMARY KEY (id);


--
-- Name: homework homework_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT homework_pkey PRIMARY KEY (id);


--
-- Name: homework_problems homework_problem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework_problems
    ADD CONSTRAINT homework_problem_pkey PRIMARY KEY (id);


--
-- Name: lectures lectures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lectures
    ADD CONSTRAINT lectures_pkey PRIMARY KEY (id);


--
-- Name: practice_exams practice_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practice_exams
    ADD CONSTRAINT practice_exams_pkey PRIMARY KEY (id);


--
-- Name: practice_questions practice_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practice_questions
    ADD CONSTRAINT practice_questions_pkey PRIMARY KEY (id);


--
-- Name: queries queries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queries
    ADD CONSTRAINT queries_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: slides slides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.slides
    ADD CONSTRAINT slides_pkey PRIMARY KEY (id);


--
-- Name: subchapters subchapters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subchapters
    ADD CONSTRAINT subchapters_pkey PRIMARY KEY (id);


--
-- Name: summaries summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.summaries
    ADD CONSTRAINT summaries_pkey PRIMARY KEY (id);


--
-- Name: textbooks textbooks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.textbooks
    ADD CONSTRAINT textbooks_pkey PRIMARY KEY (id);


--
-- Name: topics topics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_pkey PRIMARY KEY (id);


--
-- Name: waitlist waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.waitlist
    ADD CONSTRAINT waitlist_pkey PRIMARY KEY (email);


--
-- Name: messages message_status_complete_trigger; Type: TRIGGER; Schema: prod; Owner: postgres
--

CREATE TRIGGER message_status_complete_trigger AFTER UPDATE OF generation_status ON prod.messages FOR EACH ROW EXECUTE FUNCTION prod.handle_message_complete();


--
-- Name: feedback send_feedback_trigger; Type: TRIGGER; Schema: prod; Owner: postgres
--

CREATE TRIGGER send_feedback_trigger AFTER INSERT ON prod.feedback FOR EACH ROW EXECUTE FUNCTION prod.send_feedback();


--
-- Name: documents before_insert_documents; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER before_insert_documents BEFORE INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION public.insert_into_embeddings();


--
-- Name: chats chats_class_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.chats
    ADD CONSTRAINT chats_class_fkey FOREIGN KEY (class) REFERENCES prod.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: chats chats_profile_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.chats
    ADD CONSTRAINT chats_profile_fkey FOREIGN KEY (profile) REFERENCES prod.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: codes codes_class_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.codes
    ADD CONSTRAINT codes_class_fkey FOREIGN KEY (class) REFERENCES prod.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: documents documents_class_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.documents
    ADD CONSTRAINT documents_class_fkey FOREIGN KEY (class) REFERENCES prod.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: documents documents_file_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.documents
    ADD CONSTRAINT documents_file_fkey FOREIGN KEY (file) REFERENCES prod.files(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: figures figures_class_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.figures
    ADD CONSTRAINT figures_class_fkey FOREIGN KEY (class) REFERENCES prod.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: figures figures_message_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.figures
    ADD CONSTRAINT figures_message_fkey FOREIGN KEY (message) REFERENCES prod.messages(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: files files_class_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.files
    ADD CONSTRAINT files_class_fkey FOREIGN KEY (class) REFERENCES prod.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: files files_profile_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.files
    ADD CONSTRAINT files_profile_fkey FOREIGN KEY (profile) REFERENCES prod.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: google google_chat_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.google
    ADD CONSTRAINT google_chat_fkey FOREIGN KEY (chat) REFERENCES prod.chats(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: google google_document_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.google
    ADD CONSTRAINT google_document_fkey FOREIGN KEY (document) REFERENCES prod.documents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: google google_file_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.google
    ADD CONSTRAINT google_file_fkey FOREIGN KEY (file) REFERENCES prod.files(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: grades grades_file_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.grades
    ADD CONSTRAINT grades_file_fkey FOREIGN KEY (file) REFERENCES prod.files(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: grades grades_message_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.grades
    ADD CONSTRAINT grades_message_fkey FOREIGN KEY (message) REFERENCES prod.messages(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: grades grades_rubric_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.grades
    ADD CONSTRAINT grades_rubric_fkey FOREIGN KEY (rubric) REFERENCES prod.files(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: messages messages_chat_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.messages
    ADD CONSTRAINT messages_chat_fkey FOREIGN KEY (chat) REFERENCES prod.chats(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: messages messages_class_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.messages
    ADD CONSTRAINT messages_class_fkey FOREIGN KEY (class) REFERENCES prod.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: messages messages_profile_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.messages
    ADD CONSTRAINT messages_profile_fkey FOREIGN KEY (profile) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: objectives objectives_class_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.objectives
    ADD CONSTRAINT objectives_class_fkey FOREIGN KEY (class) REFERENCES prod.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: objectives objectives_message_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.objectives
    ADD CONSTRAINT objectives_message_fkey FOREIGN KEY (message) REFERENCES prod.messages(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: objectives objectives_outcome_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.objectives
    ADD CONSTRAINT objectives_outcome_fkey FOREIGN KEY (outcome) REFERENCES prod.outcomes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: onedrive onedrive_profile_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.onedrive
    ADD CONSTRAINT onedrive_profile_fkey FOREIGN KEY (profile) REFERENCES prod.profiles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: outcomes outcomes_class_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.outcomes
    ADD CONSTRAINT outcomes_class_fkey FOREIGN KEY (class) REFERENCES prod.classes(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: questions questions_class_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.questions
    ADD CONSTRAINT questions_class_fkey FOREIGN KEY (class) REFERENCES prod.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: questions questions_message_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.questions
    ADD CONSTRAINT questions_message_fkey FOREIGN KEY (message) REFERENCES prod.messages(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: reports reports_class_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.reports
    ADD CONSTRAINT reports_class_fkey FOREIGN KEY (class) REFERENCES prod.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reports reports_message_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.reports
    ADD CONSTRAINT reports_message_fkey FOREIGN KEY (message) REFERENCES prod.messages(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: summaries summaries_class_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.summaries
    ADD CONSTRAINT summaries_class_fkey FOREIGN KEY (class) REFERENCES prod.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: summaries summaries_message_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.summaries
    ADD CONSTRAINT summaries_message_fkey FOREIGN KEY (message) REFERENCES prod.messages(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: usage usage_chat_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.usage
    ADD CONSTRAINT usage_chat_fkey FOREIGN KEY (chat) REFERENCES prod.chats(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: usage usage_profile_fkey; Type: FK CONSTRAINT; Schema: prod; Owner: postgres
--

ALTER TABLE ONLY prod.usage
    ADD CONSTRAINT usage_profile_fkey FOREIGN KEY (profile) REFERENCES prod.profiles(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: chapters chapters_textbook_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_textbook_fkey FOREIGN KEY (textbook) REFERENCES public.textbooks(id);


--
-- Name: classes classes_root_node_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_root_node_fkey FOREIGN KEY (root_node) REFERENCES public.topics(id);


--
-- Name: embeddings_lecture embeddings_lecture_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.embeddings_lecture
    ADD CONSTRAINT embeddings_lecture_fkey FOREIGN KEY (lecture) REFERENCES public.lectures(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: embeddings_slide embeddings_slide_slide_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.embeddings_slide
    ADD CONSTRAINT embeddings_slide_slide_fkey FOREIGN KEY (slide) REFERENCES public.slides(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: embeddings_textbook embeddings_textbook_textbook_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.embeddings_textbook
    ADD CONSTRAINT embeddings_textbook_textbook_fkey FOREIGN KEY (textbook) REFERENCES public.textbooks(id);


--
-- Name: homework homework_class_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT homework_class_fkey FOREIGN KEY (class) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: homework_problems homework_problem_homework_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework_problems
    ADD CONSTRAINT homework_problem_homework_fkey FOREIGN KEY (homework) REFERENCES public.homework(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: homework_problems homework_problem_textbook_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework_problems
    ADD CONSTRAINT homework_problem_textbook_fkey FOREIGN KEY (textbook) REFERENCES public.textbooks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: lectures lectures_class_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lectures
    ADD CONSTRAINT lectures_class_fkey FOREIGN KEY (class) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: practice_exams practice_exams_class_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practice_exams
    ADD CONSTRAINT practice_exams_class_fkey FOREIGN KEY (class) REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: practice_questions practice_questions_practice_exam_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practice_questions
    ADD CONSTRAINT practice_questions_practice_exam_fkey FOREIGN KEY (practice_exam) REFERENCES public.practice_exams(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: queries queries_class_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.queries
    ADD CONSTRAINT queries_class_fkey FOREIGN KEY (class) REFERENCES public.classes(id);


--
-- Name: questions questions_slide_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_slide_fkey FOREIGN KEY (slide) REFERENCES public.slides(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: questions questions_topic_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_topic_fkey FOREIGN KEY (topic) REFERENCES public.topics(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: slides slides_class_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.slides
    ADD CONSTRAINT slides_class_fkey FOREIGN KEY (class) REFERENCES public.classes(id);


--
-- Name: subchapters subchapters_chapter_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subchapters
    ADD CONSTRAINT subchapters_chapter_fkey FOREIGN KEY (chapter) REFERENCES public.chapters(id);


--
-- Name: summaries summaries_slide_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.summaries
    ADD CONSTRAINT summaries_slide_fkey FOREIGN KEY (slide) REFERENCES public.slides(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: summaries summaries_topic_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.summaries
    ADD CONSTRAINT summaries_topic_fkey FOREIGN KEY (topic) REFERENCES public.topics(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: textbooks textbooks_class_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.textbooks
    ADD CONSTRAINT textbooks_class_fkey FOREIGN KEY (class) REFERENCES public.classes(id);


--
-- Name: topics topics_class_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_class_fkey FOREIGN KEY (class) REFERENCES public.classes(id);


--
-- Name: objectives Allow all deletes for authenticated users on objectives; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Allow all deletes for authenticated users on objectives" ON prod.objectives FOR DELETE TO authenticated USING (true);


--
-- Name: outcomes Allow all deletes for authenticated users on outcomes; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Allow all deletes for authenticated users on outcomes" ON prod.outcomes FOR DELETE TO authenticated USING (true);


--
-- Name: chats Enable insert access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON prod.chats FOR INSERT WITH CHECK (true);


--
-- Name: contact Enable insert access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON prod.contact FOR INSERT WITH CHECK (true);


--
-- Name: google Enable insert access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON prod.google FOR INSERT WITH CHECK (true);


--
-- Name: grades Enable insert access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON prod.grades FOR INSERT WITH CHECK (true);


--
-- Name: messages Enable insert access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON prod.messages FOR INSERT WITH CHECK (true);


--
-- Name: objectives Enable insert access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON prod.objectives FOR INSERT WITH CHECK (true);


--
-- Name: onedrive Enable insert access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON prod.onedrive FOR INSERT WITH CHECK (true);


--
-- Name: outcomes Enable insert access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON prod.outcomes FOR INSERT WITH CHECK (true);


--
-- Name: documents Enable insert for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable insert for all users" ON prod.documents FOR INSERT WITH CHECK (true);


--
-- Name: feedback Enable insert for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable insert for all users" ON prod.feedback FOR INSERT WITH CHECK (true);


--
-- Name: classes Enable insert for authenticated users only; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON prod.classes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: codes Enable insert for authenticated users only; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON prod.codes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: files Enable insert for authenticated users only; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON prod.files FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: profiles Enable insert for authenticated users only; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON prod.profiles FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: chats Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.chats FOR SELECT USING (true);


--
-- Name: classes Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.classes FOR SELECT USING (true);


--
-- Name: codes Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.codes FOR SELECT USING (true);


--
-- Name: documents Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.documents FOR SELECT USING (true);


--
-- Name: figures Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.figures FOR SELECT USING (true);


--
-- Name: files Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.files FOR SELECT USING (true);


--
-- Name: google Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.google FOR SELECT USING (true);


--
-- Name: grades Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.grades FOR SELECT USING (true);


--
-- Name: messages Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.messages FOR SELECT USING (true);


--
-- Name: objectives Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.objectives FOR SELECT USING (true);


--
-- Name: onedrive Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.onedrive FOR SELECT USING (true);


--
-- Name: outcomes Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.outcomes FOR SELECT USING (true);


--
-- Name: profiles Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.profiles FOR SELECT USING (true);


--
-- Name: questions Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.questions FOR SELECT USING (true);


--
-- Name: summaries Enable read access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON prod.summaries FOR SELECT USING (true);


--
-- Name: chats Enable update access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable update access for all users" ON prod.chats FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: classes Enable update access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable update access for all users" ON prod.classes FOR UPDATE USING (true);


--
-- Name: documents Enable update access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable update access for all users" ON prod.documents FOR UPDATE USING (true);


--
-- Name: files Enable update access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable update access for all users" ON prod.files FOR UPDATE USING (true);


--
-- Name: google Enable update access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable update access for all users" ON prod.google FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: grades Enable update access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable update access for all users" ON prod.grades FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: messages Enable update access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable update access for all users" ON prod.messages FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: objectives Enable update access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable update access for all users" ON prod.objectives FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: onedrive Enable update access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable update access for all users" ON prod.onedrive FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: outcomes Enable update access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable update access for all users" ON prod.outcomes FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: profiles Enable update access for all users; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable update access for all users" ON prod.profiles FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: codes Enable update for authenticated users only; Type: POLICY; Schema: prod; Owner: postgres
--

CREATE POLICY "Enable update for authenticated users only" ON prod.codes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: chats; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.chats ENABLE ROW LEVEL SECURITY;

--
-- Name: classes; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: codes; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.codes ENABLE ROW LEVEL SECURITY;

--
-- Name: contact; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.contact ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: figures; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.figures ENABLE ROW LEVEL SECURITY;

--
-- Name: files; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.files ENABLE ROW LEVEL SECURITY;

--
-- Name: google; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.google ENABLE ROW LEVEL SECURITY;

--
-- Name: grades; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.grades ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: objectives; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.objectives ENABLE ROW LEVEL SECURITY;

--
-- Name: onedrive; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.onedrive ENABLE ROW LEVEL SECURITY;

--
-- Name: outcomes; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.outcomes ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: questions; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.questions ENABLE ROW LEVEL SECURITY;

--
-- Name: reports; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: summaries; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: usage; Type: ROW SECURITY; Schema: prod; Owner: postgres
--

ALTER TABLE prod.usage ENABLE ROW LEVEL SECURITY;

--
-- Name: practice_exams Enable insert access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON public.practice_exams FOR INSERT WITH CHECK (true);


--
-- Name: practice_questions Enable insert access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON public.practice_questions FOR INSERT WITH CHECK (true);


--
-- Name: queries Enable insert access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON public.queries FOR INSERT WITH CHECK (true);


--
-- Name: questions Enable insert access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON public.questions FOR INSERT WITH CHECK (true);


--
-- Name: summaries Enable insert access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON public.summaries FOR INSERT WITH CHECK (true);


--
-- Name: topics Enable insert access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON public.topics FOR INSERT WITH CHECK (true);


--
-- Name: waitlist Enable insert for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for all users" ON public.waitlist FOR INSERT WITH CHECK (true);


--
-- Name: embeddings_slide Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON public.embeddings_slide FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: slides Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON public.slides FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: chapters Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.chapters FOR SELECT USING (true);


--
-- Name: classes Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.classes FOR SELECT USING (true);


--
-- Name: embeddings_lecture Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.embeddings_lecture FOR SELECT USING (true);


--
-- Name: embeddings_slide Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.embeddings_slide FOR SELECT USING (true);


--
-- Name: embeddings_textbook Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.embeddings_textbook FOR SELECT USING (true);


--
-- Name: lectures Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.lectures FOR SELECT USING (true);


--
-- Name: practice_exams Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.practice_exams FOR SELECT USING (true);


--
-- Name: practice_questions Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.practice_questions FOR SELECT USING (true);


--
-- Name: questions Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.questions FOR SELECT USING (true);


--
-- Name: slides Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.slides FOR SELECT USING (true);


--
-- Name: subchapters Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.subchapters FOR SELECT USING (true);


--
-- Name: summaries Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.summaries FOR SELECT USING (true);


--
-- Name: textbooks Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.textbooks FOR SELECT USING (true);


--
-- Name: topics Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.topics FOR SELECT USING (true);


--
-- Name: topics Enable update access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable update access for all users" ON public.topics FOR UPDATE USING (true);


--
-- Name: practice_exams Enable update for authenticated users only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable update for authenticated users only" ON public.practice_exams FOR UPDATE TO authenticated USING (true);


--
-- Name: slides Enable update for authenticated users only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable update for authenticated users only" ON public.slides FOR UPDATE TO authenticated USING (true);


--
-- Name: chapters; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

--
-- Name: classes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: embeddings_lecture; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.embeddings_lecture ENABLE ROW LEVEL SECURITY;

--
-- Name: embeddings_slide; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.embeddings_slide ENABLE ROW LEVEL SECURITY;

--
-- Name: embeddings_textbook; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.embeddings_textbook ENABLE ROW LEVEL SECURITY;

--
-- Name: homework; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;

--
-- Name: homework_problems; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.homework_problems ENABLE ROW LEVEL SECURITY;

--
-- Name: lectures; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;

--
-- Name: practice_exams; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.practice_exams ENABLE ROW LEVEL SECURITY;

--
-- Name: practice_questions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.practice_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: queries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;

--
-- Name: questions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

--
-- Name: slides; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;

--
-- Name: subchapters; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.subchapters ENABLE ROW LEVEL SECURITY;

--
-- Name: summaries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: textbooks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.textbooks ENABLE ROW LEVEL SECURITY;

--
-- Name: topics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

--
-- Name: waitlist; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime chats; Type: PUBLICATION TABLE; Schema: prod; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY prod.chats;


--
-- Name: supabase_realtime classes; Type: PUBLICATION TABLE; Schema: prod; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY prod.classes;


--
-- Name: supabase_realtime documents; Type: PUBLICATION TABLE; Schema: prod; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY prod.documents;


--
-- Name: supabase_realtime figures; Type: PUBLICATION TABLE; Schema: prod; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY prod.figures;


--
-- Name: supabase_realtime files; Type: PUBLICATION TABLE; Schema: prod; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY prod.files;


--
-- Name: supabase_realtime grades; Type: PUBLICATION TABLE; Schema: prod; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY prod.grades;


--
-- Name: supabase_realtime messages; Type: PUBLICATION TABLE; Schema: prod; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY prod.messages;


--
-- Name: supabase_realtime profiles; Type: PUBLICATION TABLE; Schema: prod; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY prod.profiles;


--
-- Name: supabase_realtime questions; Type: PUBLICATION TABLE; Schema: prod; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY prod.questions;


--
-- Name: supabase_realtime reports; Type: PUBLICATION TABLE; Schema: prod; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY prod.reports;


--
-- Name: supabase_realtime summaries; Type: PUBLICATION TABLE; Schema: prod; Owner: postgres
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY prod.summaries;


--
-- Name: FUNCTION halfvec_in(cstring, oid, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_in(cstring, oid, integer) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_in(cstring, oid, integer) TO anon;
GRANT ALL ON FUNCTION public.halfvec_in(cstring, oid, integer) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_in(cstring, oid, integer) TO service_role;


--
-- Name: FUNCTION halfvec_out(public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_out(public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_out(public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_out(public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_out(public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_recv(internal, oid, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_recv(internal, oid, integer) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_recv(internal, oid, integer) TO anon;
GRANT ALL ON FUNCTION public.halfvec_recv(internal, oid, integer) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_recv(internal, oid, integer) TO service_role;


--
-- Name: FUNCTION halfvec_send(public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_send(public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_send(public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_send(public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_send(public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_typmod_in(cstring[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_typmod_in(cstring[]) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_typmod_in(cstring[]) TO anon;
GRANT ALL ON FUNCTION public.halfvec_typmod_in(cstring[]) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_typmod_in(cstring[]) TO service_role;


--
-- Name: FUNCTION sparsevec_in(cstring, oid, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_in(cstring, oid, integer) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_in(cstring, oid, integer) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_in(cstring, oid, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_in(cstring, oid, integer) TO service_role;


--
-- Name: FUNCTION sparsevec_out(public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_out(public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_out(public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_out(public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_out(public.sparsevec) TO service_role;


--
-- Name: FUNCTION sparsevec_recv(internal, oid, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_recv(internal, oid, integer) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_recv(internal, oid, integer) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_recv(internal, oid, integer) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_recv(internal, oid, integer) TO service_role;


--
-- Name: FUNCTION sparsevec_send(public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_send(public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_send(public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_send(public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_send(public.sparsevec) TO service_role;


--
-- Name: FUNCTION sparsevec_typmod_in(cstring[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_typmod_in(cstring[]) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_typmod_in(cstring[]) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_typmod_in(cstring[]) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_typmod_in(cstring[]) TO service_role;


--
-- Name: FUNCTION vector_in(cstring, oid, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_in(cstring, oid, integer) TO postgres;
GRANT ALL ON FUNCTION public.vector_in(cstring, oid, integer) TO anon;
GRANT ALL ON FUNCTION public.vector_in(cstring, oid, integer) TO authenticated;
GRANT ALL ON FUNCTION public.vector_in(cstring, oid, integer) TO service_role;


--
-- Name: FUNCTION vector_out(public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_out(public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_out(public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_out(public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_out(public.vector) TO service_role;


--
-- Name: FUNCTION vector_recv(internal, oid, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_recv(internal, oid, integer) TO postgres;
GRANT ALL ON FUNCTION public.vector_recv(internal, oid, integer) TO anon;
GRANT ALL ON FUNCTION public.vector_recv(internal, oid, integer) TO authenticated;
GRANT ALL ON FUNCTION public.vector_recv(internal, oid, integer) TO service_role;


--
-- Name: FUNCTION vector_send(public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_send(public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_send(public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_send(public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_send(public.vector) TO service_role;


--
-- Name: FUNCTION vector_typmod_in(cstring[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_typmod_in(cstring[]) TO postgres;
GRANT ALL ON FUNCTION public.vector_typmod_in(cstring[]) TO anon;
GRANT ALL ON FUNCTION public.vector_typmod_in(cstring[]) TO authenticated;
GRANT ALL ON FUNCTION public.vector_typmod_in(cstring[]) TO service_role;


--
-- Name: FUNCTION array_to_halfvec(real[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.array_to_halfvec(real[], integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.array_to_halfvec(real[], integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.array_to_halfvec(real[], integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.array_to_halfvec(real[], integer, boolean) TO service_role;


--
-- Name: FUNCTION array_to_vector(real[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.array_to_vector(real[], integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.array_to_vector(real[], integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.array_to_vector(real[], integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.array_to_vector(real[], integer, boolean) TO service_role;


--
-- Name: FUNCTION array_to_halfvec(double precision[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.array_to_halfvec(double precision[], integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.array_to_halfvec(double precision[], integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.array_to_halfvec(double precision[], integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.array_to_halfvec(double precision[], integer, boolean) TO service_role;


--
-- Name: FUNCTION array_to_vector(double precision[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.array_to_vector(double precision[], integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.array_to_vector(double precision[], integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.array_to_vector(double precision[], integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.array_to_vector(double precision[], integer, boolean) TO service_role;


--
-- Name: FUNCTION array_to_halfvec(integer[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.array_to_halfvec(integer[], integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.array_to_halfvec(integer[], integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.array_to_halfvec(integer[], integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.array_to_halfvec(integer[], integer, boolean) TO service_role;


--
-- Name: FUNCTION array_to_vector(integer[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.array_to_vector(integer[], integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.array_to_vector(integer[], integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.array_to_vector(integer[], integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.array_to_vector(integer[], integer, boolean) TO service_role;


--
-- Name: FUNCTION array_to_halfvec(numeric[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.array_to_halfvec(numeric[], integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.array_to_halfvec(numeric[], integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.array_to_halfvec(numeric[], integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.array_to_halfvec(numeric[], integer, boolean) TO service_role;


--
-- Name: FUNCTION array_to_vector(numeric[], integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.array_to_vector(numeric[], integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.array_to_vector(numeric[], integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.array_to_vector(numeric[], integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.array_to_vector(numeric[], integer, boolean) TO service_role;


--
-- Name: FUNCTION halfvec_to_float4(public.halfvec, integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_to_float4(public.halfvec, integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_to_float4(public.halfvec, integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.halfvec_to_float4(public.halfvec, integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_to_float4(public.halfvec, integer, boolean) TO service_role;


--
-- Name: FUNCTION halfvec(public.halfvec, integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec(public.halfvec, integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.halfvec(public.halfvec, integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.halfvec(public.halfvec, integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec(public.halfvec, integer, boolean) TO service_role;


--
-- Name: FUNCTION halfvec_to_sparsevec(public.halfvec, integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_to_sparsevec(public.halfvec, integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_to_sparsevec(public.halfvec, integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.halfvec_to_sparsevec(public.halfvec, integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_to_sparsevec(public.halfvec, integer, boolean) TO service_role;


--
-- Name: FUNCTION halfvec_to_vector(public.halfvec, integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_to_vector(public.halfvec, integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_to_vector(public.halfvec, integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.halfvec_to_vector(public.halfvec, integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_to_vector(public.halfvec, integer, boolean) TO service_role;


--
-- Name: FUNCTION sparsevec_to_halfvec(public.sparsevec, integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_to_halfvec(public.sparsevec, integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_to_halfvec(public.sparsevec, integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_to_halfvec(public.sparsevec, integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_to_halfvec(public.sparsevec, integer, boolean) TO service_role;


--
-- Name: FUNCTION sparsevec(public.sparsevec, integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec(public.sparsevec, integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec(public.sparsevec, integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.sparsevec(public.sparsevec, integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec(public.sparsevec, integer, boolean) TO service_role;


--
-- Name: FUNCTION sparsevec_to_vector(public.sparsevec, integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_to_vector(public.sparsevec, integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_to_vector(public.sparsevec, integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_to_vector(public.sparsevec, integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_to_vector(public.sparsevec, integer, boolean) TO service_role;


--
-- Name: FUNCTION vector_to_float4(public.vector, integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_to_float4(public.vector, integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.vector_to_float4(public.vector, integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.vector_to_float4(public.vector, integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.vector_to_float4(public.vector, integer, boolean) TO service_role;


--
-- Name: FUNCTION vector_to_halfvec(public.vector, integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_to_halfvec(public.vector, integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.vector_to_halfvec(public.vector, integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.vector_to_halfvec(public.vector, integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.vector_to_halfvec(public.vector, integer, boolean) TO service_role;


--
-- Name: FUNCTION vector_to_sparsevec(public.vector, integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_to_sparsevec(public.vector, integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.vector_to_sparsevec(public.vector, integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.vector_to_sparsevec(public.vector, integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.vector_to_sparsevec(public.vector, integer, boolean) TO service_role;


--
-- Name: FUNCTION vector(public.vector, integer, boolean); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector(public.vector, integer, boolean) TO postgres;
GRANT ALL ON FUNCTION public.vector(public.vector, integer, boolean) TO anon;
GRANT ALL ON FUNCTION public.vector(public.vector, integer, boolean) TO authenticated;
GRANT ALL ON FUNCTION public.vector(public.vector, integer, boolean) TO service_role;


--
-- Name: FUNCTION handle_homework_complete(); Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON FUNCTION prod.handle_homework_complete() TO anon;
GRANT ALL ON FUNCTION prod.handle_homework_complete() TO authenticated;
GRANT ALL ON FUNCTION prod.handle_homework_complete() TO service_role;


--
-- Name: FUNCTION handle_lecture_complete(); Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON FUNCTION prod.handle_lecture_complete() TO anon;
GRANT ALL ON FUNCTION prod.handle_lecture_complete() TO authenticated;
GRANT ALL ON FUNCTION prod.handle_lecture_complete() TO service_role;


--
-- Name: FUNCTION handle_message_complete(); Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON FUNCTION prod.handle_message_complete() TO anon;
GRANT ALL ON FUNCTION prod.handle_message_complete() TO authenticated;
GRANT ALL ON FUNCTION prod.handle_message_complete() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON FUNCTION prod.handle_new_user() TO anon;
GRANT ALL ON FUNCTION prod.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION prod.handle_new_user() TO service_role;


--
-- Name: FUNCTION handle_textbook_complete(); Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON FUNCTION prod.handle_textbook_complete() TO anon;
GRANT ALL ON FUNCTION prod.handle_textbook_complete() TO authenticated;
GRANT ALL ON FUNCTION prod.handle_textbook_complete() TO service_role;


--
-- Name: FUNCTION send_feedback(); Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON FUNCTION prod.send_feedback() TO anon;
GRANT ALL ON FUNCTION prod.send_feedback() TO authenticated;
GRANT ALL ON FUNCTION prod.send_feedback() TO service_role;


--
-- Name: FUNCTION binary_quantize(public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.binary_quantize(public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.binary_quantize(public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.binary_quantize(public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.binary_quantize(public.halfvec) TO service_role;


--
-- Name: FUNCTION binary_quantize(public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.binary_quantize(public.vector) TO postgres;
GRANT ALL ON FUNCTION public.binary_quantize(public.vector) TO anon;
GRANT ALL ON FUNCTION public.binary_quantize(public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.binary_quantize(public.vector) TO service_role;


--
-- Name: FUNCTION cosine_distance(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.cosine_distance(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.cosine_distance(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.cosine_distance(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.cosine_distance(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION cosine_distance(public.sparsevec, public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.cosine_distance(public.sparsevec, public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.cosine_distance(public.sparsevec, public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.cosine_distance(public.sparsevec, public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.cosine_distance(public.sparsevec, public.sparsevec) TO service_role;


--
-- Name: FUNCTION cosine_distance(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.cosine_distance(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.cosine_distance(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.cosine_distance(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.cosine_distance(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION halfvec_accum(double precision[], public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_accum(double precision[], public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_accum(double precision[], public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_accum(double precision[], public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_accum(double precision[], public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_add(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_add(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_add(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_add(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_add(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_avg(double precision[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_avg(double precision[]) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_avg(double precision[]) TO anon;
GRANT ALL ON FUNCTION public.halfvec_avg(double precision[]) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_avg(double precision[]) TO service_role;


--
-- Name: FUNCTION halfvec_cmp(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_cmp(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_cmp(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_cmp(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_cmp(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_combine(double precision[], double precision[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_combine(double precision[], double precision[]) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_combine(double precision[], double precision[]) TO anon;
GRANT ALL ON FUNCTION public.halfvec_combine(double precision[], double precision[]) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_combine(double precision[], double precision[]) TO service_role;


--
-- Name: FUNCTION halfvec_concat(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_concat(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_concat(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_concat(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_concat(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_eq(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_eq(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_eq(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_eq(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_eq(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_ge(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_ge(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_ge(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_ge(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_ge(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_gt(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_gt(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_gt(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_gt(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_gt(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_l2_squared_distance(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_l2_squared_distance(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_l2_squared_distance(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_l2_squared_distance(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_l2_squared_distance(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_le(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_le(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_le(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_le(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_le(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_lt(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_lt(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_lt(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_lt(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_lt(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_mul(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_mul(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_mul(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_mul(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_mul(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_ne(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_ne(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_ne(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_ne(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_ne(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_negative_inner_product(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_negative_inner_product(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_negative_inner_product(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_negative_inner_product(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_negative_inner_product(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_spherical_distance(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_spherical_distance(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_spherical_distance(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_spherical_distance(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_spherical_distance(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION halfvec_sub(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.halfvec_sub(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.halfvec_sub(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.halfvec_sub(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.halfvec_sub(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION hamming_distance(bit, bit); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.hamming_distance(bit, bit) TO postgres;
GRANT ALL ON FUNCTION public.hamming_distance(bit, bit) TO anon;
GRANT ALL ON FUNCTION public.hamming_distance(bit, bit) TO authenticated;
GRANT ALL ON FUNCTION public.hamming_distance(bit, bit) TO service_role;


--
-- Name: FUNCTION hnsw_bit_support(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.hnsw_bit_support(internal) TO postgres;
GRANT ALL ON FUNCTION public.hnsw_bit_support(internal) TO anon;
GRANT ALL ON FUNCTION public.hnsw_bit_support(internal) TO authenticated;
GRANT ALL ON FUNCTION public.hnsw_bit_support(internal) TO service_role;


--
-- Name: FUNCTION hnsw_halfvec_support(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.hnsw_halfvec_support(internal) TO postgres;
GRANT ALL ON FUNCTION public.hnsw_halfvec_support(internal) TO anon;
GRANT ALL ON FUNCTION public.hnsw_halfvec_support(internal) TO authenticated;
GRANT ALL ON FUNCTION public.hnsw_halfvec_support(internal) TO service_role;


--
-- Name: FUNCTION hnsw_sparsevec_support(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.hnsw_sparsevec_support(internal) TO postgres;
GRANT ALL ON FUNCTION public.hnsw_sparsevec_support(internal) TO anon;
GRANT ALL ON FUNCTION public.hnsw_sparsevec_support(internal) TO authenticated;
GRANT ALL ON FUNCTION public.hnsw_sparsevec_support(internal) TO service_role;


--
-- Name: FUNCTION hnswhandler(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.hnswhandler(internal) TO postgres;
GRANT ALL ON FUNCTION public.hnswhandler(internal) TO anon;
GRANT ALL ON FUNCTION public.hnswhandler(internal) TO authenticated;
GRANT ALL ON FUNCTION public.hnswhandler(internal) TO service_role;


--
-- Name: FUNCTION inner_product(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.inner_product(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.inner_product(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.inner_product(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.inner_product(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION inner_product(public.sparsevec, public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.inner_product(public.sparsevec, public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.inner_product(public.sparsevec, public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.inner_product(public.sparsevec, public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.inner_product(public.sparsevec, public.sparsevec) TO service_role;


--
-- Name: FUNCTION inner_product(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.inner_product(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.inner_product(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.inner_product(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.inner_product(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION insert_into_embeddings(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.insert_into_embeddings() TO anon;
GRANT ALL ON FUNCTION public.insert_into_embeddings() TO authenticated;
GRANT ALL ON FUNCTION public.insert_into_embeddings() TO service_role;


--
-- Name: FUNCTION ivfflat_bit_support(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.ivfflat_bit_support(internal) TO postgres;
GRANT ALL ON FUNCTION public.ivfflat_bit_support(internal) TO anon;
GRANT ALL ON FUNCTION public.ivfflat_bit_support(internal) TO authenticated;
GRANT ALL ON FUNCTION public.ivfflat_bit_support(internal) TO service_role;


--
-- Name: FUNCTION ivfflat_halfvec_support(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.ivfflat_halfvec_support(internal) TO postgres;
GRANT ALL ON FUNCTION public.ivfflat_halfvec_support(internal) TO anon;
GRANT ALL ON FUNCTION public.ivfflat_halfvec_support(internal) TO authenticated;
GRANT ALL ON FUNCTION public.ivfflat_halfvec_support(internal) TO service_role;


--
-- Name: FUNCTION ivfflathandler(internal); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.ivfflathandler(internal) TO postgres;
GRANT ALL ON FUNCTION public.ivfflathandler(internal) TO anon;
GRANT ALL ON FUNCTION public.ivfflathandler(internal) TO authenticated;
GRANT ALL ON FUNCTION public.ivfflathandler(internal) TO service_role;


--
-- Name: FUNCTION jaccard_distance(bit, bit); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.jaccard_distance(bit, bit) TO postgres;
GRANT ALL ON FUNCTION public.jaccard_distance(bit, bit) TO anon;
GRANT ALL ON FUNCTION public.jaccard_distance(bit, bit) TO authenticated;
GRANT ALL ON FUNCTION public.jaccard_distance(bit, bit) TO service_role;


--
-- Name: FUNCTION l1_distance(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.l1_distance(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.l1_distance(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.l1_distance(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.l1_distance(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION l1_distance(public.sparsevec, public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.l1_distance(public.sparsevec, public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.l1_distance(public.sparsevec, public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.l1_distance(public.sparsevec, public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.l1_distance(public.sparsevec, public.sparsevec) TO service_role;


--
-- Name: FUNCTION l1_distance(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.l1_distance(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.l1_distance(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.l1_distance(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.l1_distance(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION l2_distance(public.halfvec, public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.l2_distance(public.halfvec, public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.l2_distance(public.halfvec, public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.l2_distance(public.halfvec, public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.l2_distance(public.halfvec, public.halfvec) TO service_role;


--
-- Name: FUNCTION l2_distance(public.sparsevec, public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.l2_distance(public.sparsevec, public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.l2_distance(public.sparsevec, public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.l2_distance(public.sparsevec, public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.l2_distance(public.sparsevec, public.sparsevec) TO service_role;


--
-- Name: FUNCTION l2_distance(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.l2_distance(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.l2_distance(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.l2_distance(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.l2_distance(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION l2_norm(public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.l2_norm(public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.l2_norm(public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.l2_norm(public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.l2_norm(public.halfvec) TO service_role;


--
-- Name: FUNCTION l2_norm(public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.l2_norm(public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.l2_norm(public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.l2_norm(public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.l2_norm(public.sparsevec) TO service_role;


--
-- Name: FUNCTION l2_normalize(public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.l2_normalize(public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.l2_normalize(public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.l2_normalize(public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.l2_normalize(public.halfvec) TO service_role;


--
-- Name: FUNCTION l2_normalize(public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.l2_normalize(public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.l2_normalize(public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.l2_normalize(public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.l2_normalize(public.sparsevec) TO service_role;


--
-- Name: FUNCTION l2_normalize(public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.l2_normalize(public.vector) TO postgres;
GRANT ALL ON FUNCTION public.l2_normalize(public.vector) TO anon;
GRANT ALL ON FUNCTION public.l2_normalize(public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.l2_normalize(public.vector) TO service_role;


--
-- Name: FUNCTION match_documents(query_embedding public.vector, match_threshold double precision, match_count integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.match_documents(query_embedding public.vector, match_threshold double precision, match_count integer) TO anon;
GRANT ALL ON FUNCTION public.match_documents(query_embedding public.vector, match_threshold double precision, match_count integer) TO authenticated;
GRANT ALL ON FUNCTION public.match_documents(query_embedding public.vector, match_threshold double precision, match_count integer) TO service_role;


--
-- Name: FUNCTION match_embeddings_lecture(query_embedding public.vector, match_count integer, filter jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.match_embeddings_lecture(query_embedding public.vector, match_count integer, filter jsonb) TO anon;
GRANT ALL ON FUNCTION public.match_embeddings_lecture(query_embedding public.vector, match_count integer, filter jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.match_embeddings_lecture(query_embedding public.vector, match_count integer, filter jsonb) TO service_role;


--
-- Name: FUNCTION match_embeddings_slide(query_embedding public.vector, match_count integer, filter jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.match_embeddings_slide(query_embedding public.vector, match_count integer, filter jsonb) TO anon;
GRANT ALL ON FUNCTION public.match_embeddings_slide(query_embedding public.vector, match_count integer, filter jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.match_embeddings_slide(query_embedding public.vector, match_count integer, filter jsonb) TO service_role;


--
-- Name: FUNCTION match_embeddings_textbook(query_embedding public.vector, match_count integer, filter jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.match_embeddings_textbook(query_embedding public.vector, match_count integer, filter jsonb) TO anon;
GRANT ALL ON FUNCTION public.match_embeddings_textbook(query_embedding public.vector, match_count integer, filter jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.match_embeddings_textbook(query_embedding public.vector, match_count integer, filter jsonb) TO service_role;


--
-- Name: FUNCTION sparsevec_cmp(public.sparsevec, public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_cmp(public.sparsevec, public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_cmp(public.sparsevec, public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_cmp(public.sparsevec, public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_cmp(public.sparsevec, public.sparsevec) TO service_role;


--
-- Name: FUNCTION sparsevec_eq(public.sparsevec, public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_eq(public.sparsevec, public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_eq(public.sparsevec, public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_eq(public.sparsevec, public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_eq(public.sparsevec, public.sparsevec) TO service_role;


--
-- Name: FUNCTION sparsevec_ge(public.sparsevec, public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_ge(public.sparsevec, public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_ge(public.sparsevec, public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_ge(public.sparsevec, public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_ge(public.sparsevec, public.sparsevec) TO service_role;


--
-- Name: FUNCTION sparsevec_gt(public.sparsevec, public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_gt(public.sparsevec, public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_gt(public.sparsevec, public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_gt(public.sparsevec, public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_gt(public.sparsevec, public.sparsevec) TO service_role;


--
-- Name: FUNCTION sparsevec_l2_squared_distance(public.sparsevec, public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_l2_squared_distance(public.sparsevec, public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_l2_squared_distance(public.sparsevec, public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_l2_squared_distance(public.sparsevec, public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_l2_squared_distance(public.sparsevec, public.sparsevec) TO service_role;


--
-- Name: FUNCTION sparsevec_le(public.sparsevec, public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_le(public.sparsevec, public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_le(public.sparsevec, public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_le(public.sparsevec, public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_le(public.sparsevec, public.sparsevec) TO service_role;


--
-- Name: FUNCTION sparsevec_lt(public.sparsevec, public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_lt(public.sparsevec, public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_lt(public.sparsevec, public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_lt(public.sparsevec, public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_lt(public.sparsevec, public.sparsevec) TO service_role;


--
-- Name: FUNCTION sparsevec_ne(public.sparsevec, public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_ne(public.sparsevec, public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_ne(public.sparsevec, public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_ne(public.sparsevec, public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_ne(public.sparsevec, public.sparsevec) TO service_role;


--
-- Name: FUNCTION sparsevec_negative_inner_product(public.sparsevec, public.sparsevec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sparsevec_negative_inner_product(public.sparsevec, public.sparsevec) TO postgres;
GRANT ALL ON FUNCTION public.sparsevec_negative_inner_product(public.sparsevec, public.sparsevec) TO anon;
GRANT ALL ON FUNCTION public.sparsevec_negative_inner_product(public.sparsevec, public.sparsevec) TO authenticated;
GRANT ALL ON FUNCTION public.sparsevec_negative_inner_product(public.sparsevec, public.sparsevec) TO service_role;


--
-- Name: FUNCTION subvector(public.halfvec, integer, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.subvector(public.halfvec, integer, integer) TO postgres;
GRANT ALL ON FUNCTION public.subvector(public.halfvec, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.subvector(public.halfvec, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.subvector(public.halfvec, integer, integer) TO service_role;


--
-- Name: FUNCTION subvector(public.vector, integer, integer); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.subvector(public.vector, integer, integer) TO postgres;
GRANT ALL ON FUNCTION public.subvector(public.vector, integer, integer) TO anon;
GRANT ALL ON FUNCTION public.subvector(public.vector, integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.subvector(public.vector, integer, integer) TO service_role;


--
-- Name: FUNCTION vector_accum(double precision[], public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_accum(double precision[], public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_accum(double precision[], public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_accum(double precision[], public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_accum(double precision[], public.vector) TO service_role;


--
-- Name: FUNCTION vector_add(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_add(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_add(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_add(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_add(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION vector_avg(double precision[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_avg(double precision[]) TO postgres;
GRANT ALL ON FUNCTION public.vector_avg(double precision[]) TO anon;
GRANT ALL ON FUNCTION public.vector_avg(double precision[]) TO authenticated;
GRANT ALL ON FUNCTION public.vector_avg(double precision[]) TO service_role;


--
-- Name: FUNCTION vector_cmp(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_cmp(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_cmp(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_cmp(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_cmp(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION vector_combine(double precision[], double precision[]); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_combine(double precision[], double precision[]) TO postgres;
GRANT ALL ON FUNCTION public.vector_combine(double precision[], double precision[]) TO anon;
GRANT ALL ON FUNCTION public.vector_combine(double precision[], double precision[]) TO authenticated;
GRANT ALL ON FUNCTION public.vector_combine(double precision[], double precision[]) TO service_role;


--
-- Name: FUNCTION vector_concat(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_concat(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_concat(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_concat(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_concat(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION vector_dims(public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_dims(public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.vector_dims(public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.vector_dims(public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.vector_dims(public.halfvec) TO service_role;


--
-- Name: FUNCTION vector_dims(public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_dims(public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_dims(public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_dims(public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_dims(public.vector) TO service_role;


--
-- Name: FUNCTION vector_eq(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_eq(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_eq(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_eq(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_eq(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION vector_ge(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_ge(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_ge(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_ge(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_ge(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION vector_gt(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_gt(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_gt(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_gt(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_gt(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION vector_l2_squared_distance(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_l2_squared_distance(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_l2_squared_distance(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_l2_squared_distance(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_l2_squared_distance(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION vector_le(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_le(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_le(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_le(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_le(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION vector_lt(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_lt(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_lt(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_lt(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_lt(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION vector_mul(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_mul(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_mul(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_mul(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_mul(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION vector_ne(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_ne(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_ne(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_ne(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_ne(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION vector_negative_inner_product(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_negative_inner_product(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_negative_inner_product(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_negative_inner_product(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_negative_inner_product(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION vector_norm(public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_norm(public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_norm(public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_norm(public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_norm(public.vector) TO service_role;


--
-- Name: FUNCTION vector_spherical_distance(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_spherical_distance(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_spherical_distance(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_spherical_distance(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_spherical_distance(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION vector_sub(public.vector, public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.vector_sub(public.vector, public.vector) TO postgres;
GRANT ALL ON FUNCTION public.vector_sub(public.vector, public.vector) TO anon;
GRANT ALL ON FUNCTION public.vector_sub(public.vector, public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.vector_sub(public.vector, public.vector) TO service_role;


--
-- Name: FUNCTION avg(public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.avg(public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.avg(public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.avg(public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.avg(public.halfvec) TO service_role;


--
-- Name: FUNCTION avg(public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.avg(public.vector) TO postgres;
GRANT ALL ON FUNCTION public.avg(public.vector) TO anon;
GRANT ALL ON FUNCTION public.avg(public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.avg(public.vector) TO service_role;


--
-- Name: FUNCTION sum(public.halfvec); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sum(public.halfvec) TO postgres;
GRANT ALL ON FUNCTION public.sum(public.halfvec) TO anon;
GRANT ALL ON FUNCTION public.sum(public.halfvec) TO authenticated;
GRANT ALL ON FUNCTION public.sum(public.halfvec) TO service_role;


--
-- Name: FUNCTION sum(public.vector); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.sum(public.vector) TO postgres;
GRANT ALL ON FUNCTION public.sum(public.vector) TO anon;
GRANT ALL ON FUNCTION public.sum(public.vector) TO authenticated;
GRANT ALL ON FUNCTION public.sum(public.vector) TO service_role;


--
-- Name: TABLE chats; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.chats TO anon;
GRANT ALL ON TABLE prod.chats TO authenticated;
GRANT ALL ON TABLE prod.chats TO service_role;


--
-- Name: TABLE classes; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.classes TO anon;
GRANT ALL ON TABLE prod.classes TO authenticated;
GRANT ALL ON TABLE prod.classes TO service_role;


--
-- Name: TABLE codes; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.codes TO anon;
GRANT ALL ON TABLE prod.codes TO authenticated;
GRANT ALL ON TABLE prod.codes TO service_role;


--
-- Name: TABLE contact; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.contact TO anon;
GRANT ALL ON TABLE prod.contact TO authenticated;
GRANT ALL ON TABLE prod.contact TO service_role;


--
-- Name: TABLE documents; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.documents TO anon;
GRANT ALL ON TABLE prod.documents TO authenticated;
GRANT ALL ON TABLE prod.documents TO service_role;


--
-- Name: TABLE feedback; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.feedback TO anon;
GRANT ALL ON TABLE prod.feedback TO authenticated;
GRANT ALL ON TABLE prod.feedback TO service_role;


--
-- Name: TABLE figures; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.figures TO anon;
GRANT ALL ON TABLE prod.figures TO authenticated;
GRANT ALL ON TABLE prod.figures TO service_role;


--
-- Name: TABLE files; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.files TO anon;
GRANT ALL ON TABLE prod.files TO authenticated;
GRANT ALL ON TABLE prod.files TO service_role;


--
-- Name: TABLE google; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.google TO anon;
GRANT ALL ON TABLE prod.google TO authenticated;
GRANT ALL ON TABLE prod.google TO service_role;


--
-- Name: TABLE grades; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.grades TO anon;
GRANT ALL ON TABLE prod.grades TO authenticated;
GRANT ALL ON TABLE prod.grades TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.messages TO anon;
GRANT ALL ON TABLE prod.messages TO authenticated;
GRANT ALL ON TABLE prod.messages TO service_role;


--
-- Name: TABLE objectives; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.objectives TO anon;
GRANT ALL ON TABLE prod.objectives TO authenticated;
GRANT ALL ON TABLE prod.objectives TO service_role;


--
-- Name: TABLE onedrive; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.onedrive TO anon;
GRANT ALL ON TABLE prod.onedrive TO authenticated;
GRANT ALL ON TABLE prod.onedrive TO service_role;


--
-- Name: TABLE outcomes; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.outcomes TO anon;
GRANT ALL ON TABLE prod.outcomes TO authenticated;
GRANT ALL ON TABLE prod.outcomes TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.profiles TO anon;
GRANT ALL ON TABLE prod.profiles TO authenticated;
GRANT ALL ON TABLE prod.profiles TO service_role;


--
-- Name: TABLE questions; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.questions TO anon;
GRANT ALL ON TABLE prod.questions TO authenticated;
GRANT ALL ON TABLE prod.questions TO service_role;


--
-- Name: TABLE reports; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.reports TO anon;
GRANT ALL ON TABLE prod.reports TO authenticated;
GRANT ALL ON TABLE prod.reports TO service_role;


--
-- Name: TABLE summaries; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.summaries TO anon;
GRANT ALL ON TABLE prod.summaries TO authenticated;
GRANT ALL ON TABLE prod.summaries TO service_role;


--
-- Name: TABLE usage; Type: ACL; Schema: prod; Owner: postgres
--

GRANT ALL ON TABLE prod.usage TO anon;
GRANT ALL ON TABLE prod.usage TO authenticated;
GRANT ALL ON TABLE prod.usage TO service_role;


--
-- Name: TABLE chapters; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chapters TO anon;
GRANT ALL ON TABLE public.chapters TO authenticated;
GRANT ALL ON TABLE public.chapters TO service_role;


--
-- Name: TABLE classes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.classes TO anon;
GRANT ALL ON TABLE public.classes TO authenticated;
GRANT ALL ON TABLE public.classes TO service_role;


--
-- Name: TABLE documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.documents TO anon;
GRANT ALL ON TABLE public.documents TO authenticated;
GRANT ALL ON TABLE public.documents TO service_role;


--
-- Name: TABLE embeddings_lecture; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.embeddings_lecture TO anon;
GRANT ALL ON TABLE public.embeddings_lecture TO authenticated;
GRANT ALL ON TABLE public.embeddings_lecture TO service_role;


--
-- Name: TABLE embeddings_slide; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.embeddings_slide TO anon;
GRANT ALL ON TABLE public.embeddings_slide TO authenticated;
GRANT ALL ON TABLE public.embeddings_slide TO service_role;


--
-- Name: TABLE embeddings_textbook; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.embeddings_textbook TO anon;
GRANT ALL ON TABLE public.embeddings_textbook TO authenticated;
GRANT ALL ON TABLE public.embeddings_textbook TO service_role;


--
-- Name: TABLE homework; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.homework TO anon;
GRANT ALL ON TABLE public.homework TO authenticated;
GRANT ALL ON TABLE public.homework TO service_role;


--
-- Name: TABLE homework_problems; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.homework_problems TO anon;
GRANT ALL ON TABLE public.homework_problems TO authenticated;
GRANT ALL ON TABLE public.homework_problems TO service_role;


--
-- Name: TABLE lectures; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lectures TO anon;
GRANT ALL ON TABLE public.lectures TO authenticated;
GRANT ALL ON TABLE public.lectures TO service_role;


--
-- Name: TABLE practice_exams; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.practice_exams TO anon;
GRANT ALL ON TABLE public.practice_exams TO authenticated;
GRANT ALL ON TABLE public.practice_exams TO service_role;


--
-- Name: TABLE practice_questions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.practice_questions TO anon;
GRANT ALL ON TABLE public.practice_questions TO authenticated;
GRANT ALL ON TABLE public.practice_questions TO service_role;


--
-- Name: TABLE queries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.queries TO anon;
GRANT ALL ON TABLE public.queries TO authenticated;
GRANT ALL ON TABLE public.queries TO service_role;


--
-- Name: SEQUENCE queries_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.queries_id_seq TO anon;
GRANT ALL ON SEQUENCE public.queries_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.queries_id_seq TO service_role;


--
-- Name: TABLE questions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.questions TO anon;
GRANT ALL ON TABLE public.questions TO authenticated;
GRANT ALL ON TABLE public.questions TO service_role;


--
-- Name: TABLE slides; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.slides TO anon;
GRANT ALL ON TABLE public.slides TO authenticated;
GRANT ALL ON TABLE public.slides TO service_role;


--
-- Name: TABLE subchapters; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.subchapters TO anon;
GRANT ALL ON TABLE public.subchapters TO authenticated;
GRANT ALL ON TABLE public.subchapters TO service_role;


--
-- Name: TABLE summaries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.summaries TO anon;
GRANT ALL ON TABLE public.summaries TO authenticated;
GRANT ALL ON TABLE public.summaries TO service_role;


--
-- Name: TABLE textbooks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.textbooks TO anon;
GRANT ALL ON TABLE public.textbooks TO authenticated;
GRANT ALL ON TABLE public.textbooks TO service_role;


--
-- Name: TABLE topics; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.topics TO anon;
GRANT ALL ON TABLE public.topics TO authenticated;
GRANT ALL ON TABLE public.topics TO service_role;


--
-- Name: TABLE waitlist; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.waitlist TO anon;
GRANT ALL ON TABLE public.waitlist TO authenticated;
GRANT ALL ON TABLE public.waitlist TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: prod; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA prod GRANT ALL ON SEQUENCES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA prod GRANT ALL ON SEQUENCES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA prod GRANT ALL ON SEQUENCES  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: prod; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA prod GRANT ALL ON FUNCTIONS  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA prod GRANT ALL ON FUNCTIONS  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA prod GRANT ALL ON FUNCTIONS  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: prod; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA prod GRANT ALL ON TABLES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA prod GRANT ALL ON TABLES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA prod GRANT ALL ON TABLES  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES  TO service_role;


