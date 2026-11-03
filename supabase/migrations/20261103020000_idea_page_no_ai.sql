-- The idea page without an AI service (Ben, 2026-11-02: "We're not adding an anthropic key, or any key for now. Do this
-- all without AI APIs"): the bull and bear case is worked out by rules each time (src/lib/ideaCase.ts) and Ask the AI
-- became quick answers, so the stored case and the chat threads from 20261103010000_idea_page.sql go. Both were empty.
drop table if exists public.idea_chats;
alter table public.setups drop column if exists cases;
