import { defineMemory } from "eve/memory";
import { fileMemory } from "eve/memory/file";
import { byPrincipal } from "eve/memory/scope";

// One small document of durable facts about the owner, recalled before each
// turn. The model maintains it with `profile__save_memory` and
// `profile__remove_memory`. Scoped to the authenticated principal, so sessions
// without one (schedules, internal runs) get no memory rather than a shared one.
export default defineMemory({
  description: "Stable facts and preferences about the owner. Never store secrets, codes or payment details here.",
  provider: fileMemory(),
  scope: byPrincipal,
});
