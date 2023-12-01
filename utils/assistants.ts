import { AssistantCreateParams, OpenAI } from "deco-sites/roast/apps/site.ts";

const getOrCreateAssistant = async (
  params: AssistantCreateParams,
  openai: OpenAI,
) => {
  let list = await openai.beta.assistants.list();

  while (list.data.length > 0 || list.hasNextPage()) {
    const assitant = list.data.find((a) => a.name === params.name);

    if (assitant) {
      await openai.beta.assistants.update(assitant.id, params);

      return assitant;
    }

    list = await list.getNextPage();
  }

  return await openai.beta.assistants.create(params);
};

const name = "Roast my Commerce - Audience expert";

const ASSISTANTS = {
  "Roast my Commerce - Audience expert": {
    name,
    instructions:
      "You are a staff software engineer and lead designer specialized in the fields of frontend development and web development, with a focus on e-commerce. You help retailers improve their site by roasting the experience on their online stores.",
    tools: [
      { type: "code_interpreter" },
      { type: "retrieval" },
    ],
    model: "gpt-4-1106-preview",
    file_ids: [],
  },
} satisfies Record<string, AssistantCreateParams>;

export const getAssistant = (name: keyof typeof ASSISTANTS, openai: OpenAI) =>
  getOrCreateAssistant(ASSISTANTS[name], openai);
