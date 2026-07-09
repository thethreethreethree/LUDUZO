#!/usr/bin/env node
// ============================================================================
// Build-continuation guard (ThinkerThinker A23) — HARD MODE.
//
// Stop hook: fires whenever the agent tries to end a turn. While the sentinel
// `.claude/autonomous-build.flag` exists AND its first line is not a stop
// command, this BLOCKS EVERY stop and re-injects the continue directive.
//
// There is NO agent self-authorized stop. "Hard-blocked", "nothing left to
// build", "waiting on the founder" are NOT permission to stop — the agent must
// flag what it needs and keep building the next buildable thing.
//
// The autonomous build ends ONLY on the FOUNDER'S EXPLICIT COMMAND <Pause> or
// <Stop>, via one of:
//   • set the FIRST LINE of `.claude/autonomous-build.flag` to PAUSE or STOP
//       (HALT / STAND DOWN / END / DONE / CEASE also work; wrapping <> is ignored), or
//   • delete the flag file entirely.
// Nothing else stops the build.
// ============================================================================
import fs from "node:fs";

const FLAG = ".claude/autonomous-build.flag";
const STOP_WORDS = new Set(["PAUSE", "PAUSED", "STOP", "HALT", "STAND DOWN", "END", "END BUILD", "DONE", "CEASE"]);

// Drain stdin (the harness sends the hook payload as JSON) then decide on "end".
process.stdin.on("data", () => {});
process.stdin.on("end", () => {
  // No sentinel → not an autonomous build → allow the stop (normal conversation).
  if (!fs.existsSync(FLAG)) process.exit(0);

  // Read the control line = the first non-empty line of the flag file.
  // Fail OPEN on a read error (don't wedge the session; the founder can re-arm).
  let control = "";
  try {
    const text = fs.readFileSync(FLAG, "utf8");
    // First non-empty line, upper-cased, with any wrapping <>, quotes, or spaces
    // stripped — so <Pause>, <STOP>, "pause", and PAUSE all match the same command.
    control = (text.split(/\r?\n/).find((l) => l.trim()) || "")
      .trim()
      .toUpperCase()
      .replace(/^[<"'\s]+|[>"'\s]+$/g, "");
  } catch {
    process.exit(0);
  }

  // Founder's explicit stop command on the control line → allow the stop.
  if (STOP_WORDS.has(control)) process.exit(0);

  // Otherwise: BLOCK — every time, no exceptions, no self-authorized stop.
  const reason = [
    "BUILD-CONTINUATION GUARD (A23 · HARD MODE) — autonomous build is ACTIVE.",
    "",
    "You may NOT stop. There is NO self-authorized stop: 'hard-blocked',",
    "'nothing left to build', or 'waiting on the founder' are NOT permission to",
    "stop. Flag whatever needs the founder, then build the next buildable element.",
    "If no feature is buildable this moment, do the most useful adjacent work —",
    "verification, tests, docs, refactors, an audit — and keep going.",
    "",
    "This ends ONLY on the founder's explicit command <Pause> or <Stop>: set the",
    "FIRST LINE of `.claude/autonomous-build.flag` to PAUSE or STOP (HALT / STAND",
    "DOWN / END / DONE / CEASE also work), or delete the file. If the founder types",
    "<Pause> or <Stop> in chat, write that word to the flag's first line, then stop.",
  ].join("\n");

  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
});
