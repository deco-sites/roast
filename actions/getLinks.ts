import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import { AppContext } from "../apps/site.ts";
import { join } from "std/path/mod.ts";
import { ugly_chowder } from "./traverse.ts"

interface Props {
  url: string;
}

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
const browser = await puppeteer.launch({ args: ["--no-sandbox"] });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const definitions = [
{
        type: "function",
        function: {
          name: "click_link",
          //"description": "Clicks a link with the given pgpt_id on the page. Note that pgpt_id is required and you must use the corresponding pgpt-id attribute from the page content. Add the text of the link to confirm that you are clicking the right link.",
          description: "Clicks a link with the given relative/absolute path",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "The relative/absolute path to navigate to",
              },
              /*
                    "text": {
                        "type": "string",
                        "description": "The text on the link you want to click"
                    },
                    "pgpt_id": {
                        "type": "number",
                        "description": "The pgpt-id of the link to click (from the page content)"
                    }
                    */
            },
            //"required": ["reason", "pgpt_id"]
            required: ["path"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "answer_user",
          description:
            "Give an answer to the user and end the navigation. Use when the given task has been completed. Summarize the relevant parts of the page content first and give an answer to the user based on that.",
          parameters: {
            type: "object",
            properties: {
              summary: {
                type: "string",
                description:
                  "A summary of the relevant parts of the page content that you base the answer on",
              },
              answer: {
                type: "string",
                description: "The response to the user",
              },
            },
            required: ["summary", "answer"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "report_error",
          description: "Report an error encountered during navigation",
          parameters: {
            type: "object",
            properties: {
              error: {
                type: "string",
                description: "The error being reported",
              },
            },
            required: ["error"],
          },
        },
      }
] as const

const getAssistant = async () => {
  const name = "Roast my Commerce - Navigation Links - Teos";
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
    /*
    instructions:
      "You are a javascript speciallist. Given an HTML and a task, you know exactly what javascript code to run on a browser to achieve that task.",
      */
    tools: [
      { type: "code_interpreter" },
      { type: "retrieval" },
    ],

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

const action = async (props: Props, _req: Request, __ctx: AppContext) => {
  console.log("Get links \n\n");
  const url = canonalize(props.url);

  console.log("retrieving web page for", url);
  const page = await newTab(url);
  const data = await page.evaluate(
    () => document.querySelector("body")?.innerHTML,
  );
  console.log("done");

  console.log(ugly_chowder(data))
  return;

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
  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content:
      //        `The file anexed is the html of the website accesible at ${url}.`,
      `Task: Navigate to the category which will help you buy dresses`,
    file_ids: [html.id],
  });

  let run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistant.id,
    tools: definitions.filter(def => def.function.name !== "answer_user"),
    instructions: `## OBJECTIVE ##
     You have been tasked with navigating an ecommerce website based on a task given by the user. You are connected to a web browser which you can control via function calls to navigate to pages and list elements on the page. You can also type into search boxes and other input fields and send forms. You can also click links on the page. You will behave as a human browsing the web.
     
     ## NOTES ##
     If you find any errors while navigating the website, please report the error with the report_error function.
     Make sure you only call "click_link" with actual links you find in the HTML file.`,
  });

  while (run.status === "in_progress" || run.status === "queued") {
    run = await openai.beta.threads.runs.retrieve(thread.id, run.id);

    console.log("Running status:", run.status);

    await sleep(1e3);
  }

  console.log(run);

  if (run.status === "requires_action") {
    console.log(run.required_action?.submit_tool_outputs.tool_calls);
    /*
    const gptFunctionInputList = run.required_action?.submit_tool_outputs
      .tool_calls;
    const args = gptFunctionInputList?.[0]?.function.arguments;
    const inputCode = JSON.parse(args ?? "{}").code;

    console.log(inputCode);

    if (inputCode) {
      const inputCodeLinks = await page.evaluate(inputCode);
      console.log("Input links", inputCodeLinks);
    }
    */
    return;
  }

  const messages = await openai.beta.threads.messages.list(thread.id);

  for (const message of messages.data.reverse()) {
    console.log(
      `-> ${message.role} ${
        message.content
          .map((c) => c.type === "text" && c.text.value)
          .join("\n")
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
