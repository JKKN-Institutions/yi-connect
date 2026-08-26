-- Private Member's Bills can carry a handed-in document (PDF / doc).
--
-- WHY THIS EXTENDS bill_documents RATHER THAN ADDING COLUMNS TO bills:
-- the attachment machinery already exists and is proven — a private
-- `yip-bill-documents` bucket, RLS enabled with NO policies (service-role
-- only, no anon/authenticated reach), and the upload / list / download /
-- delete actions in app/yip/actions/bill-documents.ts. Adding file columns
-- to yip.bills would have built a second, parallel mechanism next to a
-- working one, with its own bucket, its own RLS posture to get right, and
-- its own download path. Reusing this table keeps ONE way to attach a
-- document to a bill.
--
-- The only thing blocking reuse was ownership: a document was keyed to
-- `committee_name` (NOT NULL), and a Private Member's Bill has no committee
-- behind it — one Member writes it alone.
--
-- So a document now belongs to EXACTLY ONE owner: a committee (as before,
-- for the 6 documents already stored) or one specific bill. The CHECK makes
-- "both" and "neither" unrepresentable rather than leaving a row that no
-- screen can place.

alter table yip.bill_documents
  add column if not exists bill_id uuid references yip.bills(id) on delete cascade;

alter table yip.bill_documents
  alter column committee_name drop not null;

alter table yip.bill_documents
  add constraint bill_documents_owner_exactly_one
  check (
    (committee_name is not null and bill_id is null)
    or (committee_name is null and bill_id is not null)
  );

-- Partial: only rows that belong to a bill are ever looked up this way.
create index if not exists bill_documents_bill_id_idx
  on yip.bill_documents (bill_id) where bill_id is not null;
