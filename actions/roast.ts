import OpenAI, {
  type FileObject,
} from "https://deno.land/x/openai@v4.20.1/mod.ts";
import puppeteer, { Page } from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import { AppContext } from "../apps/site.ts";

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
    tools: [{ type: "code_interpreter" }, { type: "retrieval" }],
    model: "gpt-4-1106-preview",
  });
};

const getLinksFromMenu = async (
  { html, thread, assistant, url, lastMessageId, page }: {
    url: string;
    html: FileObject;
    thread: any;
    assistant: any;
    lastMessageId: string | undefined;
    page: Page;
  },
) => {
  await openai.beta.threads.messages.create(
    thread.id,
    {
      role: "user",
      content:
        `Give me a javascript code to access all links in the menu of the site. The output should be a markdown`,
      file_ids: [html.id],
    },
  );

  let run = await openai.beta.threads.runs.create(
    thread.id,
    {
      assistant_id: assistant.id,
      instructions:
        `You are an ecommerce expert and you need to assess multiple aspects of a website. The user will upload their website's html and you will need to infer the main audience of that website`,
    },
  );

  while (run.status !== "completed") {
    run = await openai.beta.threads.runs.retrieve(
      thread.id,
      run.id,
    );

    console.log("Running status:", run.status);

    await sleep(1e3);
  }

  const messages = await openai.beta.threads.messages.list(
    thread.id,
    { after: lastMessageId, order: "asc" },
  );

  let _lastMessageId;
  let code;
  for (const message of messages.data) {
    message.role === "assistant" && console.log(message.content);

    _lastMessageId = message.id;
  }

  try {
    console.log("code \n\n", code);
    if (code) {
      code = /\`\`\`javascript([\s\S]*)\`\`\`/.exec(code)[1];

      console.log("code", code);

      page.evaluate(code);
    }
  } catch (e) {
    console.error("Error", e);
  }

  return _lastMessageId;
};

const getSiteAudience = async ({ assistant, html, url, thread }) => {
  let run = await openai.beta.threads.runs.create(
    thread.id,
    {
      assistant_id: assistant.id,
      instructions:
        `You are an ecommerce expert and you need to assess multiple aspects of a website. The user will upload their website's html and you will need to infer the main audience of that website`,
    },
  );

  while (run.status !== "completed") {
    run = await openai.beta.threads.runs.retrieve(
      thread.id,
      run.id,
    );

    console.log("Running status:", run.status);

    await sleep(1e3);
  }

  const messages = await openai.beta.threads.messages.list(
    thread.id,
    { order: "asc" },
  );

  let lastMessageId;
  for (const message of messages.data) {
    console.log(
      `-> ${message.role} ${
        message.content.map((c) => c.type === "text" && c.text.value).join("\n")
      }`,
    );

    lastMessageId = message.id;
  }

  return lastMessageId;
};

const newTab = async (url: string) => {
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle0" });

  return page;
};

const action = async (
  { url }: Props,
  _req: Request,
  __ctx: AppContext,
) => {
  console.log("retrieving web page for", url);
  const page = await newTab(url);
  const data = await page.evaluate(() =>
    document.querySelector("body")?.innerHTML
  );
  console.log("done");

  //
  const assistant = await getAssistant();

  const thread = await openai.beta.threads.create();
  const html = await openai.files.create({
    purpose: "assistants",
    file: {
      url: new URL("index.html", url).href,
      blob: () => Promise.resolve(new Blob([data], { type: "text/html" })),
    },
  });

  await openai.beta.threads.messages.create(
    thread.id,
    {
      role: "user",
      content: `this is the content of my website, accesible at ${url}`,
      file_ids: [html.id],
    },
  );

  // let lastMessageId = await getSiteAudience({ assistant, html, thread, url });

  await getLinksFromMenu({
    assistant,
    html,
    thread,
    url,
    lastMessageId: undefined,
    page,
  });
};

export default async (props, req, ctx) => {
  try {
    return await action(props, req, ctx);
  } catch (error) {
    console.error(error);
  }
};
