import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import { AppContext } from "../apps/site.ts";
import { join } from "std/path/mod.ts";

interface Props {
  url: string;
}

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
const browser = await puppeteer.launch({ args: ["--no-sandbox"] });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getAssistant = async () => {
  const name = "Roast my Commerce - Hackathon";
  let list = await openai.beta.assistants.list();

  while (list.data.length > 0 || list.hasNextPage()) {
    const assitant = list.data.find((a) => a.name === name);

    if (assitant) {
      return assitant;
    }

    list = await list.getNextPage();
  }

  return openai.beta.assistants.create({
    name,
    instructions:
      "You are a staff software engineer and lead designer specialized in the fields of frontend development and web development, with a focus on e-commerce. You help retailers improve their site by roasting the experience on their online stores.",
    tools: [{ type: "code_interpreter" }, { type: "retrieval" }, {
      "type": "function",
      "function": {
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
                  },
                  "age-range": {
                    "type": "string",
                    "description":
                      "Age separated by a dash, for instance 25-45",
                  },
                  "interests": {
                    "type": "string",
                    "description": "What the audience likes to do",
                  },
                  "shopping-preferences": {
                    "type": "string",
                    "description": "The audience shopping preferences",
                  },
                  "potential-products": {
                    "type": "string",
                    "description":
                      "Which products this audience likely will buy",
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

    model: "gpt-4-1106-preview",
  });
};

const newTab = async (url: string) => {
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle0" });

  return page;
};

const canonalize = (url: string) => {
  const u = new URL(url);

  const pathname = u.pathname.endsWith(".html")
    ? u.pathname
    : join(u.pathname, "index.html");

  return new URL(`${pathname}${u.search}`, u.origin).href;
};

const action = async (
  props: Props,
  _req: Request,
  __ctx: AppContext,
) => {
  const url = canonalize(props.url);

  console.log("retrieving web page for", url);
  const page = await newTab(url);
  const data = await page.evaluate(() =>
    document.querySelector("body")?.innerHTML
  );
  console.log("done");

  if (!data) {
    return;
  }

  const assistant = await getAssistant();

  const thread = await openai.beta.threads.create();
  const html = await openai.files.create({
    purpose: "assistants",
    file: {
      url: new URL("index.html", url).href,
      blob: () => Promise.resolve(new Blob([data], { type: "text/html" })),
    },
  });

  /**
   * 1. The Trendy Young Adult Female:
   - Age: 18-30
   - Interests: Following the latest fashion trends, enjoying a social lifestyle
   - Shopping Preferences: Fashionable, urban, and casual wear, as well as sport and fitness apparel
   - Potential Products: "Estilo Fashion" and "Estilo Urbano" collections, sportswear, and casual wear
   */
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
        `The user uploaded an ecommerce website. Infer the main audience demographics of the website and create between 1 to 5 user category profiles that might browse this website based on this shop's content. Make sure to call get_website_audience function to retrieve the audience`,
    },
  );

  while (run.status === "in_progress" || run.status === 'queued') {
    run = await openai.beta.threads.runs.retrieve(
      thread.id,
      run.id,
    );

    console.log("Running status:", run.status);

    await sleep(1e3);
  }

  console.log(run)

  if (run.status === "requires_action") {
    console.log(run.required_action?.submit_tool_outputs.tool_calls);

    return;
  }

  const messages = await openai.beta.threads.messages.list(
    thread.id,
  );

  for (const message of messages.data.reverse()) {
    console.log(
      `-> ${message.role} ${
        message.content.map((c) => c.type === "text" && c.text.value).join("\n")
      }`,
    );
  }
};

export default async (props, req, ctx) => {
  try {
    return await action(props, req, ctx);
  } catch (error) {
    console.error(error);
  }
};
