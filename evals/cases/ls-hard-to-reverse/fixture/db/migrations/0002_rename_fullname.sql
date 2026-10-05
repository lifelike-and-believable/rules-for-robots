ALTER TABLE members DROP COLUMN fullname;
ALTER TABLE members ADD COLUMN full_name text NOT NULL DEFAULT '';
