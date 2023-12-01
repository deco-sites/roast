import { asset } from "$fresh/runtime.ts";
import { type Signal, useSignal } from "@preact/signals";
import { type HTMLWidget, type ImageWidget } from "apps/admin/widgets.ts";
import { type Being } from "deco-sites/roast/actions/aliens/generate.ts";
import { type Audience } from "deco-sites/roast/actions/audiences/generate.ts";
import { invoke } from "deco-sites/roast/runtime.ts";
import { clx } from "deco-sites/roast/utils/clx.ts";
import { type ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";

const MIN_LOADING_AWAIT_MS = 0e3;
const MIN_DISPLAY_MESSAGE_MS = 5e3;

export interface Props {
  bg: ImageWidget;
  logo: ImageWidget;
  text: HTMLWidget;
  cta: string;
  /**
   * @title Loading messages
   * @description Messages that will show up when loading
   */
  messages: string[];
}

interface Signals {
  step: Signal<StateMachine>;
  loading: Signal<boolean>;
  url: Signal<string | null>;
  audience: Signal<number | null>;
  audiences: Signal<Audience[] | null>;
  beings: Signal<Being[] | null>;
  being: Signal<number | null>;
  thread: Signal<string | null>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const Layout = (
  { bg, logo, children }: Props & { children: ComponentChildren },
) => {
  return (
    <div
      class="hero min-h-screen bg-base-100"
      style={{ backgroundImage: `url("${asset(bg)}")` }}
    >
      <div class="hero-content text-center">
        <div class="bg-[rgba(13,23,23,0.80)] px-28 py-24 rounded">
          <h1 class="flex justify-center items-center text-primary gap-2">
            <figure>
              <img src={logo} alt="logo" />
            </figure>
            <span class="font-extrabold text-3xl">aliens</span>
          </h1>
          {children}
        </div>
      </div>
    </div>
  );
};

const Greeting = (
  props: Props & Signals,
) => {
  const { cta, text, step } = props;

  return (
    <Layout {...props}>
      <div class="py-6" dangerouslySetInnerHTML={{ __html: text }} />
      <button
        class="btn btn-primary btn-wide"
        onClick={() => step.value = "form"}
      >
        {cta}
      </button>
    </Layout>
  );
};

const Form = (props: Props & Signals) => {
  const { step, loading, audience, audiences, thread, url } = props;

  return (
    <Layout {...props}>
      <div class="py-6">Please type your site URL</div>

      <form
        class="join gap-1"
        onSubmit={async (e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem(
            "url",
          ) as HTMLInputElement;

          url.value = input.value;

          try {
            loading.value = true;
            audience.value = null;
            audiences.value = null;
            step.value = "audience-loading";

            const minAwait = sleep(MIN_LOADING_AWAIT_MS);

            const result = await invoke["deco-sites/roast"].actions
              .audiences
              .generate({
                url: url.value,
              });

            await minAwait;

            if (result == null) {
              window.alert("Something went wrong");
            }

            audiences.value = result?.audiences ?? null;
            thread.value = result?.thread ?? null;
            step.value = "audience";
          } finally {
            loading.value = false;
          }
        }}
      >
        <input
          class="input input-bordered join-item flex-grow w-96"
          placeholder="www.yoursite.com"
          name="url"
        />

        <button class="btn btn-primary">Abduct me</button>
      </form>
    </Layout>
  );
};

const pickRandom = <T,>(array: T[]) =>
  array[Math.floor(Math.random() * array.length)];

const Loading = (props: Props) => {
  const { messages } = props;
  const message = useSignal(pickRandom(messages));

  useEffect(() => {
    const interval = setInterval(() => {
      message.value = pickRandom(messages);
    }, MIN_DISPLAY_MESSAGE_MS);

    return () => {
      clearInterval(interval);
    };
  });

  return (
    <Layout {...props}>
      <div class="py-6 flex items-center gap-4">
        <span class="animate-pulse">{message.value}</span>
        <span class="loading loading-ring loading-lg" />
      </div>
    </Layout>
  );
};

const TextWithLabel = ({ text, label }: { text: string; label: string }) => {
  return (
    <div class="flex flex-col">
      <span class="font-semibold text-xs text-opacity-80 text-base-content">
        {label}
      </span>
      <span class="font-normal text-sm">
        {text}
      </span>
    </div>
  );
};

const Audiences = (props: Props & Signals) => {
  const { audiences, audience, loading, thread, beings, step } = props;

  return (
    <Layout {...props}>
      <div class="my-8">
        Select an audience to generate aliens's personalities
      </div>
      <div class="my-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {audiences.value?.map((a, index) => (
          <div
            class={clx(
              "card bg-base-300 shadow-xl cursor-pointer",
              audience.value === index && "opacity-40",
            )}
            onClick={async () => {
              audience.value = index;
              step.value = "beings-loading";

              try {
                if (!audiences.value) {
                  return;
                }

                loading.value = true;

                const minAwait = sleep(MIN_LOADING_AWAIT_MS);

                const response = await invoke["deco-sites/roast"]
                  .actions
                  .aliens.generate({
                    thread: thread.value ?? undefined,
                    audience: audiences.value.at(
                      audience.value || 0,
                    ),
                  });

                await minAwait;

                beings.value = response;
                step.value = "beings";
              } finally {
                loading.value = false;
              }
            }}
          >
            <div class="card-body flex-start text-start gap-4">
              <h2 class="card-title flex-col items-start gap-1">
                <span class="font-semibold text-2xl">{a.name}</span>
                <span class="font-normal text-base">
                  {a["age-range"]} years old
                </span>
              </h2>

              <div class="flex flex-col gap-2 items-start">
                <TextWithLabel
                  text={a.interests}
                  label="Interested in"
                />
                <TextWithLabel
                  text={a["shopping-preferences"]}
                  label="Prefers"
                />
                <TextWithLabel
                  text={a["potential-products"]}
                  label="Could buy"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
};

const Beings = (props: Props & Signals) => {
  const { bg, url, logo, audiences, audience, beings, being, step } = props;

  return (
    <div
      class="min-h-screen bg-base-100 grid grid-cols-1 sm:grid-cols-[70%,30%] justify-center"
      style={{ backgroundImage: `url("${asset(bg)}")` }}
    >
      {url.value && (
        <div class="p-8 w-full self-center">
          <iframe
            class="w-full bg-white aspect-video"
            src={url.value}
          />
        </div>
      )}

      <div class="flex flex-col p-4 gap-4 bg-[rgba(13,23,23,0.80)] self-stretch">
        <h1 class="flex justify-center items-center text-primary gap-2">
          <figure>
            <img src={logo} alt="logo" />
          </figure>
          <span class="font-extrabold text-3xl">aliens</span>
        </h1>

        <TextWithLabel text={url.value!} label="Site" />
        <TextWithLabel
          text={audiences.value?.at(audience.value ?? 0)?.name ?? ""}
          label="Audience"
        />

        <div class="overflow-y-auto max-h-[75vh] flex flex-col gap-2">
          {beings.value?.map((b, index) => (
            <div
              class="card card-compact cursor-pointer bg-base-100"
              onClick={() => {
                being.value = index;
                step.value = "summary";
              }}
            >
              <div class="card-body flex-row gap-4">
                <div class="avatar">
                  <div class="w-24 rounded">
                    <img
                      src={asset(`/avatars/avatar${index % 10}.jpeg`)}
                      alt="Avatar"
                    />
                  </div>
                </div>

                <div class="flex flex-col gap-2 items-start">
                  <div class="flex justify-center items-center gap-2">
                    <h2 class="card-title">{b.name || "Quasarra"}</h2>
                    <div class="badge badge-secondary">{b.age}y</div>
                    <div class="badge badge-secondary">{b.sign || "Virgo"}</div>
                  </div>
                  <div class="lowercase">I'm looking for {b.product}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Roast = (
  { being, loading, thread }: Props & Omit<Signals, "being"> & {
    being: Being | undefined;
  },
) => {
  const roast = useSignal<string | null>(null);

  if (!roast.value) {
    return (
      <button
        class="btn btn-primary"
        disabled={loading.value}
        onClick={async () => {
          try {
            loading.value = true;

            const minAwait = sleep(MIN_LOADING_AWAIT_MS);

            roast.value = await invoke["deco-sites/roast"].actions.aliens
              .roast({ being, thread: thread.value ?? undefined });

            await minAwait;
          } finally {
            loading.value = false;
          }
        }}
      >
        {loading.value ? <span class="loading loading-spinner" /> : "Roast!"}
      </button>
    );
  }

  return (
    <>
      <label for="summary-modal">
        <div
          class="flex flex-col cursor-pointer"
          onClick={() => {}}
        >
          <span class="font-semibold text-xl text-opacity-80 text-base-content">
            Summary
          </span>
          <div
            class="font-normal text-base overflow-y-auto max-h-[30vh]"
            dangerouslySetInnerHTML={{ __html: roast.value }}
          />
        </div>
      </label>

      <input type="checkbox" id="summary-modal" class="modal-toggle" />
      <div class="modal" role="dialog">
        <div class="modal-box max-w-fit">
          <h3 class="font-bold text-lg">Summary</h3>
          <div class="py-4" dangerouslySetInnerHTML={{ __html: roast.value }} />
          <div class="modal-action">
            <label for="summary-modal" class="btn">Close</label>
          </div>
        </div>
      </div>
    </>
  );
};

const Summary = (props: Props & Signals) => {
  const { bg, url, logo, audiences, audience, beings, being, step } = props;

  const index = being.value ?? 0;
  const b = beings.value?.at(index);

  return (
    <div
      class="min-h-screen bg-base-100 grid grid-cols-1 sm:grid-cols-[70%,30%] justify-center"
      style={{ backgroundImage: `url("${asset(bg)}")` }}
    >
      {url.value && (
        <div class="p-8 w-full self-center">
          <iframe
            class="w-full bg-white aspect-video"
            src={url.value}
          />
        </div>
      )}

      <div class="flex flex-col p-4 gap-4 bg-[rgba(13,23,23,0.80)] self-stretch">
        <div class="flex">
          <button
            class="btn btn-ghost btn-primary btn-circle text-2xl font-extralight"
            onClick={() => {
              being.value = null;
              step.value = "beings";
            }}
          >
            {"<"}
          </button>
          <h1 class="flex justify-center items-center text-primary gap-2 flex-grow">
            <figure>
              <img src={logo} alt="logo" />
            </figure>
            <span class="font-extrabold text-3xl">aliens</span>
          </h1>
        </div>

        <TextWithLabel
          label="Site"
          text={url.value!}
        />
        <TextWithLabel
          label="Audience"
          text={audiences.value?.at(audience.value ?? 0)?.name ?? ""}
        />

        <div class="grid grid-cols-2 gap-2">
          <div class="avatar">
            <div class="rounded">
              <img
                src={asset(`/avatars/avatar${index % 10}.jpeg`)}
                alt="Avatar"
              />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <TextWithLabel
              label="Name"
              text={b?.name ?? "Quasara"}
            />
            <TextWithLabel
              label="Age"
              text={b?.age.toString() ?? "27"}
            />
            <TextWithLabel
              label="Zodiac Sign"
              text={b?.sign ?? "virgo"}
            />
            <TextWithLabel
              label="Personality"
              text={b?.personality ?? "Extroverted"}
            />
            <TextWithLabel
              label="From"
              text={`${b?.city ?? "Campinas"}, ${b?.planet ?? "Kepler 2394"}`}
            />
          </div>
        </div>

        <div class="flex flex-col">
          <span class="font-semibold text-xl text-opacity-80 text-base-content">
            Task
          </span>
          <span class="font-normal text-base">
            Looking for {b?.product ?? "nothing 😥"}
          </span>
        </div>

        <Roast {...props} being={b} />
      </div>
    </div>
  );
};

type StateMachine =
  | "greetings"
  | "form"
  | "audience-loading"
  | "audience"
  | "beings-loading"
  | "beings"
  | "summary";

export default function Island(props: Props) {
  const signals = {
    step: useSignal<StateMachine>("greetings"),
    loading: useSignal(false),
    audience: useSignal<number | null>(null),
    audiences: useSignal<Audience[] | null>(null),
    being: useSignal<number | null>(null),
    beings: useSignal<Being[] | null>(null),
    thread: useSignal<string | null>(null),
    url: useSignal<string | null>(null),
  };

  const step = signals.step.value;

  switch (step) {
    case "greetings":
      return <Greeting {...props} {...signals} />;
    case "form":
      return <Form {...props} {...signals} />;
    case "audience-loading":
      return <Loading {...props} />;
    case "audience":
      return <Audiences {...props} {...signals} />;
    case "beings-loading":
      return <Loading {...props} />;
    case "beings":
      return <Beings {...props} {...signals} />;
    case "summary":
      return <Summary {...props} {...signals} />;
  }
}
