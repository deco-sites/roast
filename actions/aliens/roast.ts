import { type Being } from "deco-sites/roast/actions/aliens/generate.ts";
import { getAssistant } from "deco-sites/roast/utils/assistants.ts";
import { printThread } from "deco-sites/roast/utils/debug.ts";
import { type Run } from "deco-sites/roast/apps/site.ts";
import { type AppContext } from "../../apps/site.ts";
import { withCache } from "deco-sites/roast/utils/cache.ts";

interface Props {
  being: Being;
  thread?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const action = async (
  props: Props,
  _req: Request,
  ctx: AppContext,
): Promise<string | null> => {
  const { openai } = ctx;
  const { being, thread: threadId } = props;

  const assistant = await getAssistant(
    "Roast my Commerce - Audience expert",
    openai,
  );

  const thread = threadId
    ? await openai.beta.threads.retrieve(threadId)
    : await openai.beta.threads.create();

  await openai.beta.threads.messages.create(
    thread.id,
    {
      role: "user",
      content:
        `My name is ${being.name}. I'm from sign ${being.sign}. My life goal is ${being.dream}. My personality is ${being.personality}. You are me and your task is to assess how I would evaluate the website I anexed on previous messages.
        
        For instance
        
        1. Profile: urban, fast paced nature
          Evaluation: I prefer small descriptions and vivid images. Maybe try reducing the descriptions and texts

        2. Profile: Vegan, ecofriendly
          Evaluation: Your seo descriptions are not very appealing to me, since I'm vegan and you are not endorsing veganism

        3. Profile: blind
          Evaluation: Your tags are not really accessible, some alt texts are missing`,
    },
  );

  let run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistant.id,
    instructions:
      `Assess the website regarding accessibility, language tone and other aspects important for converting the specific user`,
  });

  const continueRun = (run: Run): Promise<Run> => {
    console.log(run.status);
    switch (run.status) {
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

  const allowList = new Set(["queued", "in_progress"]);
  while (allowList.has(run.status)) {
    run = await continueRun(run);
    await sleep(1e3);
  }

  await printThread(thread.id, openai);

  const messages = await openai.beta.threads.messages.list(thread.id);

  return messages.data[0].content.map((c) =>
    `<p>${c.type === "text" ? c.text.value : c.image_file.file_id}</p>`
  ).join("");
};

export default withCache(action);
