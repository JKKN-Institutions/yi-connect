-- Take Pride 2026: one real delegate per name + chapter.
--
-- The delegate import (app/take-pride/desk/delegates) skips a row whose
-- name + chapter is already in the real list, but that check runs in app
-- code. Two organisers confirming the same myCII file at once could both pass
-- it and insert every delegate twice (two badges, two pass links each).
-- This index makes the database refuse the second copy.
--
-- The expression mirrors delegateKey() in lib/take-pride/import.ts:
-- trimmed, inner whitespace collapsed, lower-cased. Sample rows are exempt.
-- ADDITIVE ONLY: a new index on an existing tp_* table. No data changes.

create unique index if not exists tp_delegates_real_name_chapter_key
  on yi_connect.tp_delegates (
    lower(regexp_replace(btrim(full_name), '\s+', ' ', 'g')),
    lower(regexp_replace(btrim(chapter), '\s+', ' ', 'g'))
  )
  where not is_sample;
