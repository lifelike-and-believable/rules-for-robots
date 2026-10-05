CREATE TABLE members (
  id serial PRIMARY KEY,
  fullname text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
