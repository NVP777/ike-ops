-- Sample data for trying out the app. Run once in the Supabase SQL editor.
-- Everything is made up and is created under your Captain account. Delete it from the app when you are done.
-- It does nothing if Finance, Documents or Inventory already hold rows, so running it twice is harmless.
-- It runs as one step: if anything fails, nothing is added.

do $$
declare
  cap_email text; cap uuid; me text;
  d1 uuid; d2 uuid; d3 uuid; r1 uuid; r2 uuid; r3 uuid;
begin
  if exists (select 1 from public.transactions) or exists (select 1 from public.documents) or exists (select 1 from public.stock_items) then
    raise notice 'Skipped: there is already data in Finance, Documents or Inventory.';
    return;
  end if;

  select email into cap_email from public.members where role = 'Captain' order by email limit 1;
  if cap_email is null then raise exception 'No Captain found in members.'; end if;
  select id into cap from auth.users where lower(email) = lower(cap_email);
  if cap is null then raise exception 'The Captain (%) has never signed in, so there is no login for them yet. Sign in once, then run this again.', cap_email; end if;

  -- Act as the Captain for this script, so the database fills in the author and log fields the same way the app does.
  perform set_config('request.jwt.claim.sub', cap::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', cap, 'email', cap_email, 'role', 'authenticated')::text, true);
  me := public.my_name();

  -- Transactions
  insert into public.transactions (name, amount, txn_date, account, tag, note, author_id, author_name) values
    ('Sponsorship from Kirloskar Components', 45000, current_date - 21, 'bank',   'Management',    'First installment. The rest comes after the test run.', cap, me),
    ('Aluminium tubes, 6 m',                  -8200, current_date - 14, 'bank',   'Mech',          'Bought from the local supplier, bill attached.',        cap, me),
    ('Registration fee',                     -12000, current_date - 10, 'dean',   'Management',    'Paid before the deadline.',                             cap, me),
    ('Hardware store run',                     -640, current_date - 5,  'bitsaa', 'Mech',          'Cutting discs and a pack of M6 bolts.',                 cap, me),
    ('Printing for the design report',         -380, current_date - 2,  'bitsaa', 'Miscellaneous', 'Two colour copies.',                                    cap, me);

  -- Reimbursements: one waiting, one approved, one paid (the paid one also creates its expense in Transactions)
  insert into public.reimbursements (who, what, amount, tag, note, requested_on, status, author_id, author_name)
    values ('Rohan', 'Zip ties and tape', 420, 'Mech', 'Needed for the wiring harness.', current_date - 6, 'requested', cap, me) returning id into r1;
  insert into public.reimbursements (who, what, amount, tag, note, requested_on, status, author_id, author_name)
    values ('Ananya', 'Brake fluid', 760, 'Mech', 'Two bottles of DOT 4.', current_date - 12, 'approved', cap, me) returning id into r2;
  insert into public.reimbursements (who, what, amount, tag, note, requested_on, status, author_id, author_name)
    values ('Dev', 'Courier for the sponsor letter', 310, 'Miscellaneous', 'Sent to the Pune office.', current_date - 18, 'requested', cap, me) returning id into r3;
  perform set_config('ike.pay_account', 'bank', true);
  perform set_config('ike.pay_date', (current_date - 3)::text, true);
  update public.reimbursements set status = 'paid' where id = r3;

  -- Documents, with versions
  insert into public.documents (kind, title, description, tag, due_date, doc_date, author_id, author_name)
    values ('doc', 'Design report draft', 'The report we submit before the design review.', 'Mech', current_date + 6, current_date - 9, cap, me) returning id into d1;
  insert into public.document_versions (document_id, n, link, note, version_date, author_id, author_name) values
    (d1, 1, 'https://drive.google.com/', 'First version', current_date - 9, cap, me),
    (d1, 2, 'https://drive.google.com/', 'Added the suspension section', current_date - 5, cap, me),
    (d1, 3, 'https://drive.google.com/', 'Fixed the weight table', current_date - 1, cap, me);

  insert into public.documents (kind, title, description, tag, due_date, doc_date, author_id, author_name)
    values ('doc', 'Safety checklist', 'Everything the scrutineers look at on inspection day.', 'Management', current_date + 20, current_date - 4, cap, me) returning id into d2;
  insert into public.document_versions (document_id, n, link, note, version_date, author_id, author_name)
    values (d2, 1, 'https://drive.google.com/', 'First version', current_date - 4, cap, me);

  insert into public.documents (kind, title, description, tag, due_date, doc_date, author_id, author_name)
    values ('sub', 'Safety checklist', 'Copy sent to the organisers.', 'Management', current_date + 20, current_date - 4, cap, me) returning id into d3;
  insert into public.document_versions (document_id, n, link, note, version_date, author_id, author_name)
    values (d3, 1, 'https://drive.google.com/', 'First version', current_date - 4, cap, me);

  -- Inventory
  insert into public.stock_items (name, qty, unit, min_qty, tag, location, note, item_date, author_id, author_name) values
    ('M6 bolts',       150, 'pcs',   40, 'Mech', 'Shelf A2',       'Stainless, 20 mm.',                  current_date - 30, cap, me),
    ('Cutting discs',   12, 'pcs',    5, 'Mech', 'Workshop drawer', '',                                   current_date - 30, cap, me),
    ('Safety gloves',    2, 'pairs',  4, 'Mech', 'Workshop locker', 'Running low, a request is open.',   current_date - 30, cap, me);

  insert into public.purchase_requests (name, qty, cost, tag, note, status, request_date, author_id, author_name)
    values ('Welding gloves', 6, 1800, 'Mech', 'The current pairs are worn through.', 'requested', current_date - 2, cap, me);

  -- Subsystem tasks
  insert into public.subsystems (name, lead, task, status, blocked_reason, author_id, author_name) values
    ('Suspension',  'Meera', 'Finish the wishbone analysis',      'active',  '',                                       cap, me),
    ('Electronics', 'Karan', 'Fit the motor controller',          'blocked', 'Supplier says three more weeks',         cap, me),
    ('Brakes',      'Ishaan', 'Bleed and test the front circuit', 'done',    '',                                       cap, me);

  -- Announcements
  insert into public.notifications (title, body, audience) values
    ('Chassis fabrication moves to Saturday', 'The welding bay is booked for the junior batch on Friday, so we are shifting chassis work to Saturday at 9 am. Bring your own gloves if you have a pair.', 'Everyone'),
    ('Sponsor call at 6 pm today', 'The call with the bearing supplier is at 6. Please have the updated quote and the cost sheet open before you join.', 'Captain');
end $$;
