import { expect, test, type Page } from "@playwright/test";
import { STRATEGY_IDS } from "../engine/types.ts";

// Round D: the timeline is the one control for picking a period. These
// cover the keyboard, scrubbing, the legend's lock and clear, and the
// readout agreeing with the detail below it.

const Q = "c=USD&a=15000&s=2026-10-17&d=2027-08-01&k=6&sp=0.5&t=2";

async function open(page: Page) {
  await page.goto(`/?${Q}`);
  const slider = page.getByRole("slider", { name: "Start of the period" });
  await slider.scrollIntoViewIfNeeded();
  await expect(slider).toBeVisible();
  return {
    slider,
    value: async () => Number(await slider.getAttribute("aria-valuenow")),
    max: async () => Number(await slider.getAttribute("aria-valuemax")),
    heading: page.getByRole("heading", { name: /^The period starting / }),
    readoutDate: page.getByTestId("readout-date"),
  };
}

const days = (a: string, b: string) =>
  (new Date(`${b} UTC`).getTime() - new Date(`${a} UTC`).getTime()) /
  86_400_000;

test("the chart is a slider: arrows, Page Up/Down, Home and End", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "keyboard");
  const t = await open(page);
  const max = await t.max();
  expect(await t.value()).toBe(max); // the latest period by default
  await t.slider.focus();

  await page.keyboard.press("Home");
  expect(await t.value()).toBe(0);
  await expect(t.heading).toHaveText("The period starting 4 Jan 1999");

  await page.keyboard.press("ArrowRight");
  expect(await t.value()).toBe(1);
  await page.keyboard.press("ArrowLeft");
  expect(await t.value()).toBe(0);

  // Page Up: about a calendar month later (the nearest trading day).
  const before = (await t.readoutDate.textContent())!;
  await page.keyboard.press("PageUp");
  const after = (await t.readoutDate.textContent())!;
  expect(days(before, after)).toBeGreaterThanOrEqual(27);
  expect(days(before, after)).toBeLessThanOrEqual(34);
  await page.keyboard.press("PageDown");
  expect(await t.value()).toBe(0);

  await page.keyboard.press("End");
  expect(await t.value()).toBe(max);
  // The value is spoken with the date and all four costs.
  await expect(t.slider).toHaveAttribute(
    "aria-valuetext",
    /^\d{1,2} \w{3} \d{4}: All at once S\$[\d,]+, Equal tranches S\$[\d,]+, Wait until deadline S\$[\d,]+, Target rate S\$[\d,]+$/,
  );
});

test("dragging across the chart scrubs the period, and the detail follows", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "mouse drag");
  const t = await open(page);
  const box = (await t.slider.boundingBox())!;
  const yMid = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.2, yMid);
  await page.mouse.down();
  const first = await t.value();
  const seen = new Set<number>([first]);
  for (const f of [0.3, 0.4, 0.5, 0.6]) {
    await page.mouse.move(box.x + box.width * f, yMid, { steps: 4 });
    seen.add(await t.value());
  }
  await page.mouse.up();
  // The selection moved with the pointer, forwards, while it was down.
  expect(seen.size).toBeGreaterThanOrEqual(4);
  expect(await t.value()).toBeGreaterThan(first);
  // The detail below shows the period where the drag ended.
  await expect(t.heading).toHaveText(
    `The period starting ${await t.readoutDate.textContent()}`,
  );
});

test("hovering previews a period without selecting it", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "hover");
  const t = await open(page);
  const selected = await t.value();
  const box = (await t.slider.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  await expect(t.readoutDate).not.toHaveText(
    (await t.heading.textContent())!.replace("The period starting ", ""),
  );
  await expect(page.getByTestId("timeline-readout")).toContainText(
    "Pointing at",
  );
  expect(await t.value()).toBe(selected);
  // One marker only, wherever it stands.
  await expect(page.getByTestId("marker")).toHaveCount(1);
  await page.mouse.move(0, 0);
  await expect(page.getByTestId("timeline-readout")).toContainText("Selected");
});

test("a tap on the chart selects that period", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch");
  const t = await open(page);
  const latest = await t.heading.textContent();
  const box = (await t.slider.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * 0.4, box.y + box.height / 2);
  await expect(t.heading).not.toHaveText(latest!);
  await expect(t.heading).toHaveText(
    `The period starting ${await t.readoutDate.textContent()}`,
  );
});

test("the legend locks a strategy; Show all and Esc clear it", async ({
  page,
}) => {
  const t = await open(page);
  const legend = page.getByRole("button", { name: /^Equal tranches S\$/ });
  await legend.click();
  await expect(legend).toHaveAttribute("aria-pressed", "true");
  // The other lines fade to 15% (after their 150ms transition); text keeps
  // its colour (no opacity on text).
  await expect
    .poll(async () =>
      (
        await t.slider
          .locator("svg > path, svg > g:not([data-testid])")
          .evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity))
      ).filter((o) => o === "0.15"),
    )
    .toHaveLength(3);
  const names = page.getByTestId("legend-name");
  for (const o of await names.evaluateAll((els) =>
    els.map((e) => getComputedStyle(e).opacity),
  ))
    expect(o).toBe("1");

  await page.getByTestId("show-all").click();
  await expect(legend).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("show-all")).toHaveCount(0);

  await legend.click();
  await expect(legend).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(legend).toHaveAttribute("aria-pressed", "false");
  await expect(
    page
      .getByRole("region", { name: "Comparison at a glance" })
      .getByRole("button", { pressed: true }),
  ).toHaveCount(0);
});

test("the readout's costs match the detail's 'at the latest rate'", async ({
  page,
  isMobile,
}) => {
  const t = await open(page);
  // A period years back, picked by tap or click.
  const box = (await t.slider.boundingBox())!;
  if (isMobile)
    await page.touchscreen.tap(box.x + box.width * 0.35, box.y + 40);
  else await page.mouse.click(box.x + box.width * 0.35, box.y + 40);
  const date = (await t.readoutDate.textContent())!;
  await expect(t.heading).toHaveText(`The period starting ${date}`);
  for (const id of STRATEGY_IDS) {
    const readout = (await page.getByTestId(`readout-${id}`).textContent())!;
    expect(readout).toMatch(/^S\$[\d,]+$/);
    if (isMobile)
      // "at the latest rate", or "at the rate on 17 Oct 2026" for this past
      // start: whichever the timeline is rescaled to.
      await expect(page.getByTestId(`conversions-${id}`)).toContainText(
        new RegExp(
          `${readout.replace(/[$]/g, "\\$")} at (the latest rate|the rate on)`,
        ),
      );
    else
      await expect(page.getByTestId(`detail-today-${id}`)).toHaveText(readout);
  }
});
