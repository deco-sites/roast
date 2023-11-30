import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts";
export { type FunctionDefinition } from "https://deno.land/x/openai@v4.20.1/resources/shared.ts";
export { type Run } from "https://deno.land/x/openai@v4.20.1/resources/beta/threads/runs/runs.ts";
export { type AssistantCreateParams } from "https://deno.land/x/openai@v4.20.1/resources/beta/assistants/assistants.ts";

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

export default openai;
