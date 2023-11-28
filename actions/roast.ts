import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts";
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
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

    return await action(props, req, ctx)
  } catch (error) {
    console.error(error)
  };
  }
