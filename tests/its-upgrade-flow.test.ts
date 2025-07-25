import { describe, it } from "vitest";
import { upgradeITSBasedContract } from "./upgrade-utils";
describe("its-upgrade-flow", () => {
  it("should be able to upgrade ITS", () => {
    upgradeITSBasedContract("service");
  });
});
