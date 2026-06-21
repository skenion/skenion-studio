import { describe, expect, it } from "vitest";
import { readDesktopLaunchContext } from "./launchContext";

describe("launchContext", () => {
  it("parses runtime URL, session, profile, and window mode from query params", () => {
    expect(
      readDesktopLaunchContext(
        "?runtimeUrl=https%3A%2F%2Fruntime.example.test%2F&sessionId=alpha&runtimeProfile=remote&windowId=win-2&windowMode=isolated-runtime"
      )
    ).toEqual({
      profileId: "remote",
      runtimeUrl: "https://runtime.example.test",
      sessionId: "alpha",
      windowId: "win-2",
      windowMode: "isolated-runtime"
    });
  });

  it("falls back to local-managed default session for invalid launch params", () => {
    expect(
      readDesktopLaunchContext("?runtimeUrl=%20&sessionId=&runtimeProfile=bad&windowMode=unknown")
    ).toMatchObject({
      profileId: "local-managed",
      runtimeUrl: "http://localhost:3761",
      sessionId: "default",
      windowMode: "shared-session"
    });
  });
});
