-- INSERT is granted per column too, not per table.
--
-- The spine granted INSERT on the whole table while granting UPDATE per
-- column, and wrote in a comment that this makes id, owner, version,
-- created_at and updated_at impossible for a client to write. That is true of
-- UPDATE and was never true of INSERT: the trigger pins id only on update
-- (new.id := old.id), so a client could choose the id of the row it inserted.
--
-- It is not a hole between users — RLS still decides the owner, and a primary
-- key collision refuses an id that already exists — but the plan calls id the
-- anchor of every module that comes later, and says identity is immutable in
-- the database. A promise the grants did not keep.
--
-- title is the whole list because Capture is the only insert there is. When
-- something needs to insert another column, it is added here, in the migration
-- that needs it.

revoke insert on table public.items from authenticated;

grant insert (title) on table public.items to authenticated;
