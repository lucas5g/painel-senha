-- Baseline of the original PostgreSQL schema, preserving existing constraints.
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, email text NOT NULL UNIQUE,
 password_hash text NOT NULL, active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
 email text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS units (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, timezone text NOT NULL DEFAULT 'America/Sao_Paulo', active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS user_units (
 user_id uuid REFERENCES users(id), unit_id uuid REFERENCES units(id), PRIMARY KEY(user_id, unit_id)
);
CREATE TABLE IF NOT EXISTS desks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), unit_id uuid NOT NULL REFERENCES units(id), name text NOT NULL,
 active boolean NOT NULL DEFAULT true, UNIQUE(unit_id, name), UNIQUE(id, unit_id)
);
CREATE TABLE IF NOT EXISTS people (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cpf text UNIQUE, name text NOT NULL, birth_date date NOT NULL,
 CHECK(cpf IS NULL OR cpf ~ '^[0-9]{11}$')
);
CREATE TABLE IF NOT EXISTS counters (
 unit_id uuid REFERENCES units(id), day date NOT NULL, service text NOT NULL CHECK(service IN ('FAM','CRI','TRI','IDE')),
 value integer NOT NULL CHECK(value > 0), PRIMARY KEY(unit_id,day,service)
);
CREATE TABLE IF NOT EXISTS tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), unit_id uuid NOT NULL REFERENCES units(id), person_id uuid NOT NULL REFERENCES people(id),
 day date NOT NULL, service text NOT NULL CHECK(service IN ('FAM','CRI','TRI','IDE')), number integer NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT clock_timestamp(), called_at timestamptz,
 UNIQUE(unit_id,day,service,number), UNIQUE(id,unit_id)
);
CREATE INDEX IF NOT EXISTS tickets_queue ON tickets(unit_id,day,issued_at,id) WHERE called_at IS NULL;
CREATE TABLE IF NOT EXISTS desk_current (
 desk_id uuid PRIMARY KEY, unit_id uuid NOT NULL, ticket_id uuid NOT NULL,
 FOREIGN KEY(desk_id,unit_id) REFERENCES desks(id,unit_id), FOREIGN KEY(ticket_id,unit_id) REFERENCES tickets(id,unit_id)
);
CREATE TABLE IF NOT EXISTS call_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, unit_id uuid NOT NULL REFERENCES units(id),
 ticket_id uuid NOT NULL, desk_id uuid NOT NULL, desk_name text NOT NULL, called_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(ticket_id,unit_id) REFERENCES tickets(id,unit_id), FOREIGN KEY(desk_id,unit_id) REFERENCES desks(id,unit_id)
);
CREATE INDEX IF NOT EXISTS calls_unit ON call_events(unit_id,id);
CREATE TABLE IF NOT EXISTS operations (
 user_id uuid REFERENCES users(id), request_id uuid NOT NULL, payload text NOT NULL, result jsonb NOT NULL,
 PRIMARY KEY(user_id,request_id)
);
