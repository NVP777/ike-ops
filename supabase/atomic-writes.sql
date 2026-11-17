-- All-or-nothing writes, plus a guard against duplicate document version numbers.
-- Safe to re-run, in the Supabase SQL editor.
-- These functions run with the CALLER's rights (not security definer), so your existing row policies still decide who may do what.

-- Delete a transaction. If it is a reimbursement payment, the claim goes back to Approved in the same step.
create or replace function public.delete_transaction(p_id uuid)
returns void language plpgsql set search_path = public as $$
declare t public.transactions; n int;
begin
  select * into t from public.transactions where id = p_id;
  if t.id is null then raise exception 'Transaction not found, or you are not allowed to delete it'; end if;
  if t.reimbursement_id is not null then
    update public.reimbursements set status = 'approved' where id = t.reimbursement_id;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'Only the captain can delete a reimbursement payment'; end if;
    -- the status change already removes the linked transaction; make sure it is gone
    delete from public.transactions where id = p_id;
  else
    delete from public.transactions where id = p_id;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'You are not allowed to delete this transaction'; end if;
  end if;
end $$;

-- Create a document (and optionally a copy in another list) together with its first version.
create or replace function public.create_documents(
  p_kinds text[], p_title text, p_desc text, p_tag text, p_due date, p_today date,
  p_file_path text, p_file_name text, p_file_size bigint, p_file_type text, p_link text)
returns void language plpgsql set search_path = public as $$
declare k text; d uuid;
begin
  foreach k in array p_kinds loop
    insert into public.documents (kind, title, description, tag, due_date, doc_date)
    values (k, p_title, coalesce(p_desc, ''), p_tag, p_due, p_today) returning id into d;
    insert into public.document_versions (document_id, n, file_path, file_name, file_size, file_type, link, note, version_date)
    values (d, 1, p_file_path, p_file_name, p_file_size, p_file_type, coalesce(p_link, ''), 'First version', p_today);
  end loop;
end $$;

-- Add a version. The document row is locked first, so two people adding at once get 2 and 3, never 2 and 2.
create or replace function public.add_document_version(
  p_doc uuid, p_today date, p_file_path text, p_file_name text, p_file_size bigint, p_file_type text, p_link text, p_note text)
returns int language plpgsql set search_path = public as $$
declare v int;
begin
  perform 1 from public.documents where id = p_doc for update;
  if not found then raise exception 'Document not found, or you are not allowed to add a version'; end if;
  select coalesce(max(n), 0) + 1 into v from public.document_versions where document_id = p_doc;
  insert into public.document_versions (document_id, n, file_path, file_name, file_size, file_type, link, note, version_date)
  values (p_doc, v, p_file_path, p_file_name, p_file_size, p_file_type, coalesce(p_link, ''), coalesce(p_note, ''), p_today);
  return v;
end $$;

revoke all on function public.delete_transaction(uuid) from public, anon;
revoke all on function public.create_documents(text[], text, text, text, date, date, text, text, bigint, text, text) from public, anon;
revoke all on function public.add_document_version(uuid, date, text, text, bigint, text, text, text) from public, anon;
grant execute on function public.delete_transaction(uuid) to authenticated;
grant execute on function public.create_documents(text[], text, text, text, date, date, text, text, bigint, text, text) to authenticated;
grant execute on function public.add_document_version(uuid, date, text, text, bigint, text, text, text) to authenticated;

-- A second line of defence: one version number per document. Only added if no duplicates exist yet.
do $$
begin
  if exists (select 1 from public.document_versions group by document_id, n having count(*) > 1) then
    raise notice 'Duplicate version numbers already exist; the unique index was NOT added. Fix them, then re-run.';
  else
    create unique index if not exists document_versions_doc_n_key on public.document_versions (document_id, n);
  end if;
end $$;

notify pgrst, 'reload schema';
