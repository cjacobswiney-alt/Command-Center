-- Email archive — every email scanned, queryable
create table if not exists emails (
  id text primary key,                          -- Microsoft Graph message id
  direction text not null,                      -- 'received' | 'sent'
  conversation_id text,                         -- thread id
  subject text,
  body_text text,                               -- plain text body (HTML stripped via Graph Prefer header)
  body_preview text,                            -- ~250 char preview
  sender_name text,
  sender_email text,
  recipients jsonb,                             -- [{name, email, type: 'to'|'cc'}]
  is_read boolean,
  importance text,                              -- 'low'|'normal'|'high'
  has_attachments boolean,
  date_at timestamptz not null,                 -- received or sent date
  raw jsonb,
  ingested_at timestamptz default now()
);

create index if not exists idx_emails_date on emails(date_at desc);
create index if not exists idx_emails_sender on emails(sender_email);
create index if not exists idx_emails_conversation on emails(conversation_id);
create index if not exists idx_emails_subject_fts on emails using gin (to_tsvector('english', coalesce(subject, '')));
create index if not exists idx_emails_body_fts on emails using gin (to_tsvector('english', coalesce(body_text, '')));
