import { describe, it } from "vitest";
import { upgradeITSBasedContract } from "./upgrade-utils";
describe("itf-upgrade-flow", () => {
  it("should be able to upgrade ITF", () => {
    upgradeITSBasedContract("factory");
  });
});
