import { ServerPackageBuilder } from "../ServerPackageBuilder.ts";
import { DefaultPackageBuilder } from "../DefaultPackageBuilder.ts";
import { join } from "node:path";

describe("ServerPackageBuilder", () => {

  it("should create an instance of ServerPackageBuilder", () => {
    const builder = new ServerPackageBuilder();
    expect(builder).toBeInstanceOf(ServerPackageBuilder);
  });

  it("Creating package with control via telegram bot", async () => {
    const builder = new ServerPackageBuilder(
      join(import.meta.dir, "../../serverVideoCapture")
    ).builder(new DefaultPackageBuilder());

    await builder.createPackage("first-build", join(import.meta.dir, "../dist"));
  }, 120 * 1000);

});
