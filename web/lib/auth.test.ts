import { describe, it, expect } from "vitest";
import { checkToken } from "./auth";

describe("checkToken - optional token gate", () => {
  it("is open (no gate) when no token is configured", () => {
    expect(checkToken(undefined, undefined, undefined)).toBe("open");
    expect(checkToken("", "anything", "anything")).toBe("open");
  });

  it("accepts a matching cookie", () => {
    expect(checkToken("secret", "secret", undefined)).toBe("ok");
  });

  it("accepts a matching provided token (header/query)", () => {
    expect(checkToken("secret", undefined, "secret")).toBe("ok");
  });

  it("denies when configured but nothing matches", () => {
    expect(checkToken("secret", undefined, undefined)).toBe("deny");
    expect(checkToken("secret", "wrong", "wrong")).toBe("deny");
  });

  it("denies a token of the wrong length (no partial match)", () => {
    expect(checkToken("secret", "sec", undefined)).toBe("deny");
    expect(checkToken("secret", undefined, "secretlong")).toBe("deny");
  });
});
