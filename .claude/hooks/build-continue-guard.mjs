#!/usr/bin/env node
// Build-continuation guard (ThinkerThinker A23). Stop hook: fires when the agent
// tries to end a turn. While an autonomous build is active (sentinel file present),
// it blocks the FIRST stop and re-injects the Build-Stop Decision protocol, so the
// agent cannot silently stop building. Loop-safe via stop_hook_active. Inert when
// no autonomous build is active (sentinel absent) — normal chat is not nagged.
//
// Toggle: an autonomous build creates `.claude/autonomous-build.flag`; the founder
// saying "stop" removes it.
import fs from "node:fs";

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let data = {};
  try {
    data = JSON.parse(input || "{}");
  } catch {
    /* ignore malformed input — fail open */
  }

  // Already continuing because of this hook → allow the stop (prevents loops).
  if (data.stop_hook_active) process.exit(0);

  // Only enforce during an active autonomous build.
  if (!fs.existsSync(".claude/autonomous-build.flag")) process.exit(0);

  const reason = [
    "BUILD-CONTINUATION GUARD (A23) — an autonomous build is active.",
    "",
    "State your Build-Stop Decision before stopping. You may stop ONLY if:",
    "  (a) the founder told you to stop, OR",
    "  (b) you are hard-blocked AND no other element is buildable without founder input.",
    "",
    "A limitation that merely needs the founder to run a migration/probe or make a",
    "runtime decision is FLAG-AND-CONTINUE, not stop: note it, then build the next",
    "buildable element. If neither (a) nor (b) holds, do NOT stop — keep building.",
    "",
    "If you are genuinely stopping, write: 'STOPPING — condition (a)/(b): <evidence>'.",
    "To end the autonomous build, the founder removes .claude/autonomous-build.flag.",
  ].join("\n");

  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
});
