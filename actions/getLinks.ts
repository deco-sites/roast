import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts";
import { Page } from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import { openPage } from "../utils/puppeteer.ts";
import { AppContext } from "../apps/site.ts";
import { get_page_content, get_tabbable_elements } from "./traverse.ts";
import { withCache } from "deco-sites/roast/utils/cache.ts";

interface Props {
  url: string;
}

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ID_KEY = "pgpt-id";

const definitions = [
  {
    type: "function",
    function: {
      name: "click_link",
      //"description": "Clicks a link with the given pgpt_id on the page. Note that pgpt_id is required and you must use the corresponding pgpt-id attribute from the page content. Add the text of the link to confirm that you are clicking the right link.",
      // description: "Clicks a link element given it's pgpt-id",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The text on the link you want to click",
          },
          [ID_KEY]: {
            type: "string",
            // description:
            // "The pgpt-id of an element that should be clicked (from the page content)",
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
        required: ["text", ID_KEY],
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
  },
] as const;

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

interface Step {
  img: string;
  url: string;
}

const execute = async (
  page: Page,
  task: string,
  maxDepth: number,
  steps: Step[] = [],
) => {
  if (maxDepth == 0) return null;
  const screenshot: string = await page.screenshot({
    encoding: "base64",
    type: "jpeg",
  }) as string;
  steps.push({ img: screenshot, url: page.url() });
  const [, ids] = await get_tabbable_elements(page);
  const content = await get_page_content(page);
  // console.log(content);

  const assistant = await getAssistant();

  const thread = await openai.beta.threads.create();

  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content:
      //        `The file anexed is the html of the website accesible at ${url}.`,
      `Task: ${task}`,
  });

  const tools = definitions.filter((def) =>
    def.function.name !== "answer_user"
  );
  const clickFnIdx = definitions.findIndex((def) =>
    def.function.name === "click_link"
  );
  const clonedClickLink = structuredClone(tools[clickFnIdx]);
  // @ts-expect-error this value exists
  clonedClickLink.function.parameters.properties[ID_KEY].enums = ids;

  tools[clickFnIdx] = clonedClickLink;

  // console.log(clonedClickLink.function.parameters.properties[ID_KEY]);

  let run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistant.id,
    tools,
    instructions: `## OBJECTIVE ##
     You have been tasked with navigating an ecommerce website based on a task given by the user. You are connected to a web browser which you can control via function calls to navigate to pages and list elements on the page. You can also type into search boxes and other input fields and send forms. You can also click links on the page. You will behave as a human browsing the web.
     
     ## NOTES ##
     If you find any errors while navigating the website, please report the error with the report_error function. Commerce website has three kind of pages:
     1. landing pages that contains product lists, info about the brand, search bar to search products;
     2. product listing pages contains products based on a specific query;
     3. product description pages that contains a product description, images about the product and a button to add the product, present in the page, into the cart.
     
     ${content}`,
  });

  while (run.status === "in_progress" || run.status === "queued") {
    run = await openai.beta.threads.runs.retrieve(thread.id, run.id);

    console.log("Running status:", run.status);

    await sleep(1e3);
  }

  console.log(run);

  if (run.status === "requires_action") {
    const action = run.required_action?.submit_tool_outputs.tool_calls[0]
      .function.arguments;
    const clickLinkProps = JSON.parse(action ?? "");
    const puppyAction = `document.querySelector('[pgpt-id="${
      clickLinkProps["pgpt-id"]
    }"]').click()`;
    console.log(
      "action",
      puppyAction,
    );
    await page.click(`[pgpt-id="${clickLinkProps["pgpt-id"]}"]`);
    await page.waitForNavigation({
      // timeout: navigation_timeout,
      waitUntil: "load",
    });
    await execute(page, task, maxDepth - 1, steps);
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

const action = async (props: Props, _req: Request, ctx: AppContext) => {
  console.log("Get links \n\n");
  console.log("retrieving web page for", props.url);
  const page = await openPage(props.url, ctx.browserless);

  const task =
    "Navigate to a tshirt product page then click to add the product into the cart/basket";
  const maxDepth = 5;
  const steps: Step[] = [];
  try {
    await execute(page, task, maxDepth, steps);
  } catch (_err) {
    console.error(_err);
    return null;
  }

  return steps;
};

export default withCache(async (props, req, ctx) => {
  try {
    return await action(props, req, ctx);
  } catch (error) {
    console.error(error);
    return null;
  }
});
