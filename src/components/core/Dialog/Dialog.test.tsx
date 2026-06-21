import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { Dialog } from "./Dialog";
import { theme } from "../../../theme";

describe("Dialog", () => {
  it("uses the shared compact icon close button", () => {
    const html = renderToStaticMarkup(
      <MantineProvider theme={theme}>
        <Dialog centered onClose={() => undefined} opened title="Settings">
          Body
        </Dialog>
      </MantineProvider>
    );

    expect(html).toContain("Settings");
    expect(html).toContain("aria-label=\"Close dialog\"");
    expect(html).toContain("data-skenion-core-button=\"icon\"");
  });
});
