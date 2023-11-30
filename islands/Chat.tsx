import { useSignal } from "@preact/signals";
import { type Being } from "deco-sites/roast/actions/aliens/generate.ts";
import { type Audience } from "deco-sites/roast/actions/audiences/generate.ts";
import { clx } from "deco-sites/roast/utils/clx.ts";
import { invoke } from "../runtime.ts";
import { asset } from "$fresh/runtime.ts";

export default function Input() {
  const loading = useSignal(false);
  const selected = useSignal<Set<number>>(new Set());
  const audiences = useSignal<Audience[] | null>(null);
  const beings = useSignal<Being[] | null>(null);
  const thread = useSignal<string | null>(null);

  return (
    <div class="flex flex-col items-center gap-4">
      <form
        class="join"
        onSubmit={async (e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem(
            "url",
          ) as HTMLInputElement;

          try {
            loading.value = true;
            selected.value = new Set();
            audiences.value = null;

            const result = await invoke["deco-sites/roast"].actions.audiences
              .generate({
                url: input.value,
              });

            if (result == null) {
              window.alert("Something went wrong");
            }

            audiences.value = result?.audiences ?? null;
            thread.value = result?.thread ?? null;
          } finally {
            loading.value = false;
          }
        }}
      >
        <input
          class={clx(
            "input input-bordered join-item min-w-min",
            audiences.value && "input-disabled",
          )}
          name="url"
          placeholder="What is your website?"
        />
        <button
          disabled={loading.value || Boolean(audiences.value)}
          class="btn join-item btn-primary"
        >
          {loading.value ? <span class="loading loading-spinner" /> : "Send"}
        </button>
      </form>
      <div class="flex-grow flex flex-col items-end">
        {audiences.value && (
          <>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {audiences.value?.map((a, index) => (
                <div class="card bg-base-300 shadow-xl">
                  <div class="card-body">
                    <h2 class="card-title flex-wrap">
                      <span>{a.name}</span>
                      <div class="badge">{a["age-range"]}</div>
                    </h2>
                    <p>
                      <span class="badge badge-secondary">Interested in</span>
                      {" "}
                      {a.interests}
                    </p>
                    <p>
                      <span class="badge badge-secondary">Prefers</span>{" "}
                      {a["shopping-preferences"]}
                    </p>
                    <p>
                      <span class="badge badge-secondary">Could buy</span>{" "}
                      {a["potential-products"]}
                    </p>
                    <div class="card-actions justify-end">
                      <input
                        type="checkbox"
                        class="toggle"
                        checked={selected.value.has(index)}
                        onChange={() => {
                          const set = new Set(selected.value);

                          if (set.has(index)) {
                            set.delete(index);
                          } else {
                            set.add(index);
                          }

                          selected.value = set;
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <button
                class="btn btn-outline"
                disabled={loading.value}
                onClick={async () => {
                  try {
                    if (!audiences.value) {
                      return;
                    }

                    loading.value = true;

                    const response = await invoke["deco-sites/roast"].actions
                      .aliens.generate({
                        thread: thread.value ?? undefined,
                        audiences: audiences.value.filter((_, index) =>
                          selected.value.has(index)
                        ),
                      });

                    beings.value = response;
                  } finally {
                    loading.value = false;
                  }
                }}
              >
                {loading.value
                  ? <span class="loading loading-spinner" />
                  : "Contact aliens"}
              </button>
            </div>
          </>
        )}
        {beings.value && (
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {beings.value.map((being) => (
              <div class="card bg-base-300 shadow-xl">
                <div class="p-4 flex flex-col gap-2 items-center justify-center">
                  <figure>
                    <div class="avatar">
                      <div class="w-24 rounded-full">
                        <img
                          src={asset(
                            `/avatars/avatar${
                              Math.floor(Math.random() * 4)
                            }.jpeg`,
                          )}
                        />
                      </div>
                    </div>
                  </figure>
                  <h2 class="card-title justify-center flex-col gap-2">
                    <span>{being.name}</span>
                    <span class="text-sm font-light">{being.personality}</span>
                    <div class="flex gap-2">
                      <div class="badge badge-secondary">{being.age}y</div>
                      <div class="badge badge-secondary">{being.sign}</div>
                    </div>
                  </h2>
                </div>
                <div class="card-body">
                  <p>{being.product}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
