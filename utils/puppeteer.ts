import { context } from "deco/mod.ts";
import puppeteer, {
  Browser,
} from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

let promise: Promise<Browser> | null = null;

const useBrowserless = true || context.isDeploy;

const getBrowser = () => {
  if (!promise) {
    promise = !useBrowserless
      ? puppeteer.launch({ args: ["--no-sandbox"] })
      : puppeteer.connect({
        browserWSEndpoint:
          "wss://chrome.browserless.io?token=1d72d5a3-f93c-4329-abbd-c04cb1f49287",
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

export const openPage = async (url: string) => {
  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle0" });

  return page;
};
