import { context } from "deco/mod.ts";
import puppeteer, {
  Browser,
} from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

let promise: Promise<Browser> | null = null;

const useBrowserless = context.isDeploy;

const getBrowser = (token: string | null) => {
  if (!promise) {
    promise = !useBrowserless
      ? puppeteer.launch({ args: ["--no-sandbox"] })
      : puppeteer.connect({
        browserWSEndpoint: `wss://chrome.browserless.io?token=${token}`,
      });

    promise.then((browser) => {
      browser.on("disconnected", () => {
        console.log("disconnected from browserless");
        promise = null;
      });
    });
  }

  return promise;
};

export const openPage = async (url: string, token: string | null) => {
  const browser = await getBrowser(token);
  const page = await browser.newPage();
  page.setViewport({
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
  });

  await page.goto(url, { waitUntil: "networkidle0" });

  return page;
};
