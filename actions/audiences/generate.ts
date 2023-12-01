import { openPage } from "deco-sites/roast/utils/puppeteer.ts";
import { join } from "std/path/mod.ts";
import { AppContext } from "../../apps/site.ts";
import { getAssistant } from "deco-sites/roast/utils/assistants.ts";
import openai, { Run } from "deco-sites/roast/utils/openai.ts";
import { printThread } from "deco-sites/roast/utils/debug.ts";
import { withCache } from "deco-sites/roast/utils/cache.ts";

interface Props {
  url: string;
}

export interface Audience {
  /** @description Title of a possible website audience */
  name: string;
  /** @description Age separated by a dash, for instance 25-45 */
  "age-range": string;
  /** @description What the audience likes to do */
  interests: string;
  /** @description The audience shopping preferences */
  "shopping-preferences": string;
  /** @description Which products this audience likely will buy */
  "potential-products": string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const canonalize = (url: string) => {
  const u = new URL(url);

  const pathname = u.pathname.endsWith(".html")
    ? u.pathname
    : join(u.pathname, "index.html");

  return new URL(`${pathname}${u.search}`, u.origin).href;
};

export interface AudienceResponse {
  audiences: Audience[];
  thread: string;
}

/**
 * 1. The Trendy Young Adult Female:
 * - Age: 18-30
 * - Interests: Following the latest fashion trends, enjoying a social lifestyle
 * - Shopping Preferences: Fashionable, urban, and casual wear, as well as sport and fitness apparel
 * - Potential Products: "Estilo Fashion" and "Estilo Urbano" collections, sportswear, and casual wear
 */
const action = async (
  props: Props,
  _req: Request,
  __ctx: AppContext,
): Promise<AudienceResponse | null> => {
  const url = canonalize(props.url);

  console.log("retrieving web page for", url);
  const page = await openPage(url);
  const data = await page.evaluate(() =>
    document.querySelector("body")?.innerHTML
  );
  console.log("done");

  if (!data) {
    throw new Error("Missing page data");
  }

  const assistant = await getAssistant("Roast my Commerce - Audience expert");

  const thread = await openai.beta.threads.create();
  const html = await openai.files.create({
    purpose: "assistants",
    file: {
      url: new URL("index.html", url).href,
      blob: () => Promise.resolve(new Blob([data], { type: "text/html" })),
    },
  });

  await openai.files.waitForProcessing(html.id);

  await openai.beta.threads.messages.create(
    thread.id,
    {
      role: "user",
      content:
        `The file anexed is the html of the website accesible at ${url}.`,
      file_ids: [html.id],
    },
  );

  let run = await openai.beta.threads.runs.create(
    thread.id,
    {
      assistant_id: assistant.id,
      instructions:
        `The user anexed an ecommerce website. Infer the main audience demographics of the website and create 3 user category profiles that might browse this website based on this shop's content by calling get_website_audience function`,
      tools: [{
        type: "function",
        function: {
          "name": "get_website_audience",
          "description":
            "Function to get a possible audience for a given ecommerce website",
          "parameters": {
            "type": "object",
            "properties": {
              "audiences": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "name": {
                      "type": "string",
                      "description": "Title of a possible website audience",
                      "examples": [
                        "Fashion-forward Professionals",
                        "Trendy Young Adults",
                        "Eco-Conscious Consumers",
                      ],
                    },
                    "age-range": {
                      "type": "string",
                      "description":
                        "Age separated by a dash, for instance 25-45",
                    },
                    "interests": {
                      "type": "string",
                      "description": "What the audience likes to do",
                      "examples": [
                        "Fashion, Sustainability",
                        "Sustainability, Technology",
                        "Trendy clothing, Music, Social media",
                        "Environmental sustainability, Eco-friendly products, Organic living",
                      ],
                    },
                    "shopping-preferences": {
                      "type": "string",
                      "description": "The audience shopping preferences",
                      "examples": [
                        "Designer clothing, Eco-friendly accessories, Innovative gadgets",
                        "Trendy outfits, Affordable accessories, Popular music-related merchandise",
                      ],
                    },
                    "potential-products": {
                      "type": "string",
                      "description":
                        "Which products this audience likely will buy",
                      "examples": [
                        "shoes, dresses, shirts",
                        "hats",
                        "glasses",
                        "gadgets",
                      ],
                    },
                  },
                  "required": [
                    "name",
                    "age-range",
                    "interests",
                    "shopping-preferences",
                    "potential-products",
                  ],
                },
              },
            },
            "required": ["audiences"],
          },
        },
      }],
    },
  );

  let audiences: Audience[] | null = null;
  const continueRun = (run: Run): Promise<Run> => {
    console.log(run.status);
    switch (run.status) {
      case "requires_action": {
        const calls = run.required_action?.submit_tool_outputs.tool_calls ?? [];

        for (const call of calls) {
          if (call.function.name === "get_website_audience") {
            audiences = JSON.parse(call.function.arguments)?.audiences;
          }
        }

        return openai.beta.threads.runs.submitToolOutputs(
          thread.id,
          run.id,
          {
            tool_outputs: calls.map((call) => ({
              output: call.function.arguments,
              tool_call_id: call.id,
            })),
          },
        );
      }
      case "queued":
      case "in_progress":
        return openai.beta.threads.runs.retrieve(
          thread.id,
          run.id,
        );
      default:
        return Promise.resolve(run);
    }
  };

  const allowList = new Set(["queued", "in_progress", "requires_action"]);
  while (allowList.has(run.status)) {
    run = await continueRun(run);
    await sleep(1e3);
  }

  if (!audiences) {
    await openai.beta.threads.messages.create(
      thread.id,
      {
        role: "user",
        content: `Generate the audiences by calling the function`,
      },
    );

    run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
    });

    while (allowList.has(run.status)) {
      run = await continueRun(run);
      await sleep(1e3);
    }
  }

  await printThread(thread.id);

  return audiences
    ? {
      audiences,
      thread: thread.id,
    }
    : null;
};

export default withCache(action);
