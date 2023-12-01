import { type Being } from "deco-sites/roast/actions/aliens/generate.ts";
import { getAssistant } from "deco-sites/roast/utils/assistants.ts";
import { printThread } from "deco-sites/roast/utils/debug.ts";
import openai, { Run } from "deco-sites/roast/utils/openai.ts";
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
  __ctx: AppContext,
): Promise<string | null> => {
  const { being, thread: threadId } = props;

  const assistant = await getAssistant("Roast my Commerce - Audience expert");

  const thread = threadId
    ? await openai.beta.threads.retrieve(threadId)
    : await openai.beta.threads.create();

  await openai.beta.threads.messages.create(
    thread.id,
    {
      role: "user",
      content:
        `My name is ${being.name}. I'm from sign ${being.sign}. My life goal is ${being.dream}. My personality is ${being.personality}`,
    },
  );

  let run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistant.id,
    instructions:
      `${being.name} is an user browsing the website anexed on previous messages. Given the user profile, generate possible issues the user might face when visiting the website. Also, create some suggestions to improve the website. Use a first person tone as if the user is saying the sentence.
Examples: 
    - My fast paced nature makes me want to have big images and small descriptions. Your texts are way to big and I have to time to read them all. 
    - Your seo descriptions are not very appealing to me, since I'm vegan and you are not endorsing veganism
    - Your tags are not really accessible, since I'm blind and you are missing some alt text on image tags
    - I cant really use your website since your pages are way too big (more than 50Kb is too powerfull for me)`,
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

  await printThread(thread.id);

  const messages = await openai.beta.threads.messages.list(thread.id);

  return messages.data[0].content.map((c) =>
    `<p>${c.type === "text" ? c.text.value : c.image_file.file_id}</p>`
  ).join("");
};

export default withCache(action);
