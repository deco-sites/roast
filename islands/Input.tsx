import { invoke } from '../runtime.ts'

export default function Input() {
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        const input = e.currentTarget.elements.namedItem(
          "url-input",
        ) as HTMLInputElement;

        

        const result = await invoke["deco-sites/roast"].actions.roast({url: input.value})
      }}
    >
      <input name="url-input" placeholder={"Hello world"} />
      <button>Submit</button>
    </form>
  );
}
