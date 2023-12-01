import { SecretString } from "apps/website/loaders/secretString.ts";
import website, { Props as WebsiteProps } from "apps/website/mod.ts";
import { type App as A, AppContext as AC } from "deco/mod.ts";
import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts";
import manifest, { Manifest } from "../manifest.gen.ts";

export { type OpenAI } from "https://deno.land/x/openai@v4.20.1/mod.ts";
export { type AssistantCreateParams } from "https://deno.land/x/openai@v4.20.1/resources/beta/assistants/assistants.ts";
export { type Run } from "https://deno.land/x/openai@v4.20.1/resources/beta/threads/runs/runs.ts";
export { type FunctionDefinition } from "https://deno.land/x/openai@v4.20.1/resources/shared.ts";

type WebsiteApp = ReturnType<typeof website>;

interface Props extends WebsiteProps {
  openai: SecretString;
  browserless: SecretString;
}

export default function Site(
  props: Props,
) {
  const openai = new OpenAI({
    apiKey: props.openai || Deno.env.get("OPENAI_API_KEY"),
  });

  const state = {
    ...props,
    openai,
  };

  const app: A<Manifest, typeof state, [WebsiteApp]> = {
    state,
    manifest,
    dependencies: [website(state)],
  };

  return app;
}

export { onBeforeResolveProps } from "apps/website/mod.ts";
export type SiteApp = ReturnType<typeof Site>;
export type SiteManifest = Manifest;
export type AppContext = AC<SiteApp>;
