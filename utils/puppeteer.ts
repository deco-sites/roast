import { context } from "deco/mod.ts";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

const browserPromise = context.isDeploy
  ? puppeteer.connect({
    browserWSEndpoint:
      "wss://chrome.browserless.io?token=1d72d5a3-f93c-4329-abbd-c04cb1f49287",
  })
  : puppeteer.launch({ args: ["--no-sandbox"] });

export const openPage = async (url: string) => {
  const browser = await browserPromise;
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle0" });

  return page;
};
