export const clx = (...args: (string | number | null | false)[]) =>
  args.filter(Boolean).join(" ");
