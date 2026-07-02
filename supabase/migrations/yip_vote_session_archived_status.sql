-- yip_vote_session_archived_status
--
-- Adds an 'archived' terminal state to yip.vote_sessions.status.
--
-- Why: the projector (lib/yip/hooks/use-vote-session.ts) and
-- getActiveVoteSession() only display sessions whose status is in
-- ('open','closed','revealed'). The old CHECK constraint pinned status to
-- exactly that set, so a revealed vote could NEVER leave the display set — its
-- result stayed glued to the big screen forever and the bill/session view could
-- not render underneath it (the Erode 2026 "sticky results" incident).
--
-- 'archived' is a non-displayed terminal status. clearVoteResults() moves
-- revealed sessions to it so the projector falls back to the live session view.
-- Stored standings live on the bill / participant rows, so archiving a session
-- changes only what the screen shows, never the recorded outcome.

ALTER TABLE yip.vote_sessions
  DROP CONSTRAINT vote_sessions_status_check,
  ADD  CONSTRAINT vote_sessions_status_check
       CHECK (status = ANY (ARRAY['open', 'closed', 'revealed', 'archived']));
