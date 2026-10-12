import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { can, roleRank, validRole, ROLES } from "../src/lib/rbac.js";

describe("M7 rbac matrix", () => {
  it("reader reads, cannot mutate", () => {
    for (const a of ["read", "export"]) assert.equal(can("reader", a), true);
    for (const a of ["create", "append", "comment", "edit", "deleteCommentary", "import", "snapshot", "sync", "restore", "repair", "deleteSnapshot"]) {
      assert.equal(can("reader", a), false, a);
    }
  });

  it("editor mutates but cannot restore/repair", () => {
    for (const a of ["create", "append", "comment", "edit", "import", "snapshot", "sync"]) {
      assert.equal(can("editor", a), true, a);
    }
    assert.equal(can("editor", "restore"), false);
    assert.equal(can("editor", "repair"), false);
    assert.equal(can("editor", "deleteSnapshot"), false);
  });

  it("admin can do everything; unknown actions denied", () => {
    for (const a of ["read", "create", "import", "sync", "restore", "repair", "deleteSnapshot"]) {
      assert.equal(can("admin", a), true, a);
    }
    assert.equal(can("admin", "drop-database"), false);
    assert.deepEqual(ROLES, ["reader", "editor", "admin"]);
    assert.ok(roleRank("reader") < roleRank("editor") && roleRank("editor") < roleRank("admin"));
    assert.equal(validRole("root"), "editor");
    assert.equal(validRole("reader"), "reader");
  });
});
