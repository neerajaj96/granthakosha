/** Stable identifier helpers. */

let counter = 0;

export function newScriptureId() {
  const r =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `s_${Date.now().toString(36)}_${r}`;
}

export function passageId(scriptureId, ordinal) {
  return `${scriptureId}:p:${ordinal}`;
}

export function newCommentaryId() {
  counter += 1;
  const r =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `c_${Date.now().toString(36)}${counter.toString(36)}_${r}`;
}

/** For tests: reset in-memory counter. */
export function __resetIdCounter() {
  counter = 0;
}
