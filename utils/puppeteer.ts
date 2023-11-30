import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

const browserPromise = puppeteer.launch({ args: ["--no-sandbox"] });

export const openPage = async (url: string) => {
  const browser = await browserPromise;
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle0" });

  return page;
};
