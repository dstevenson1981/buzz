import { expect, test } from "@playwright/test";

import { installMockBridge } from "../helpers/bridge";

const AGENT_PUBKEY = "a1".repeat(32);
const OWNER_PUBKEY = "deadbeef".repeat(8);
const REQUEST_ID = "relay-agent-config-request";

async function openAgentsView(page: import("@playwright/test").Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("open-agents-view")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByTestId("open-agents-view").click();
  await expect(
    page.getByTestId(`relay-agent-card-${AGENT_PUBKEY}`),
  ).toBeVisible({ timeout: 10_000 });
}

async function waitForControlSend(
  page: import("@playwright/test").Page,
  count = 1,
) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & { __BUZZ_E2E_COMMANDS__?: string[] }
          ).__BUZZ_E2E_COMMANDS__?.filter(
            (command) => command === "build_observer_control_event",
          ).length ?? 0,
      ),
    )
    .toBeGreaterThanOrEqual(count);
}

async function emitControlResult(
  page: import("@playwright/test").Page,
  payload: unknown,
) {
  await page.evaluate(
    ({ agentPubkey, result }) => {
      const target = window as Window & {
        __BUZZ_E2E_SEED_OBSERVER_EVENTS__?: (input: {
          agentPubkey: string;
          events: Array<Record<string, unknown>>;
        }) => void;
      };
      target.__BUZZ_E2E_SEED_OBSERVER_EVENTS__?.({
        agentPubkey,
        events: [
          {
            seq: Date.now(),
            timestamp: new Date().toISOString(),
            kind: "control_result",
            agentIndex: null,
            channelId: null,
            sessionId: null,
            turnId: null,
            payload: result,
          },
        ],
      });
    },
    { agentPubkey: AGENT_PUBKEY, result: payload },
  );
}

test("owner edits a remotely managed relay agent", async ({ page }) => {
  await installMockBridge(page, {
    relayAgents: [
      {
        pubkey: AGENT_PUBKEY,
        name: "Cloud Builder",
        agentType: "claude-agent-acp",
        ownerPubkey: OWNER_PUBKEY,
        capabilities: ["remote-config-v1"],
        allowedRuntimes: ["claude-agent-acp", "codex-acp"],
        channelNames: ["general"],
        respondTo: "anyone",
      },
    ],
  });
  await openAgentsView(page);

  await page.evaluate((requestId) => {
    Object.defineProperty(window.crypto, "randomUUID", {
      configurable: true,
      value: () => requestId,
    });
  }, REQUEST_ID);

  const card = page.getByTestId(`relay-agent-card-${AGENT_PUBKEY}`);
  await card
    .getByRole("button", { name: "Open actions for Cloud Builder" })
    .click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.getByTestId("relay-agent-edit-dialog")).toBeVisible();
  await waitForControlSend(page);
  await emitControlResult(page, {
    type: "get_configuration",
    status: "ok",
    requestId: REQUEST_ID,
    configuration: {
      runtime: "claude-agent-acp",
      systemPrompt: "Build carefully and report progress in the thread.",
      model: "claude-sonnet",
      allowedRuntimes: ["claude-agent-acp", "codex-acp"],
    },
  });

  const dialog = page.getByTestId("relay-agent-edit-dialog");
  await expect(dialog.getByLabel("Agent instructions")).toHaveValue(
    "Build carefully and report progress in the thread.",
  );
  await expect(dialog.getByLabel("Model")).toHaveValue("claude-sonnet");
  await expect(dialog.getByRole("combobox", { name: "Runtime" })).toHaveText(
    "Claude Code",
  );

  await dialog
    .getByLabel("Agent instructions")
    .fill("Review first, then implement.");
  await dialog.getByRole("combobox", { name: "Runtime" }).click();
  await page.getByRole("option", { name: "Codex" }).click();
  await dialog.getByLabel("Model").fill("gpt-5");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await waitForControlSend(page, 2);
  await emitControlResult(page, {
    type: "update_configuration",
    status: "accepted",
    requestId: REQUEST_ID,
    restartRequired: true,
  });

  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Cloud Builder saved and is restarting."),
  ).toBeVisible();
});
