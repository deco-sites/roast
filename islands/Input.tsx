import { invoke } from "../runtime.ts";

export default function Input() {
  return (
    <form
      class="join"
      onSubmit={async (e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem(
          "url-input",
        ) as HTMLInputElement;

        const result = await invoke["deco-sites/roast"].actions.roast({
          url: input.value,
        });
      }}
    >
      <input
        class="input input-bordered join-item"
        name="url-input"
        placeholder={"Hello world"}
      />
      <button class="btn join-item rounded-r-full">Submit</button>
    </form>
  );
}
