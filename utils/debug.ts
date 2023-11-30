import openai from "deco-sites/roast/utils/openai.ts";

export const printThread = async (thread: string) => {
  const str = [];

  let messages = await openai.beta.threads.messages.list(thread);

  while (messages.data.length > 0) {
    for (const message of messages.data) {
      for (const content of message.content) {
        str.push(
          `[${message.role.toUpperCase()}] ${
            content.type === "text"
              ? content.text.value
              : content.image_file.file_id
          }`,
        );
      }
    }

    if (messages.hasNextPage()) {
      messages = await messages.getNextPage();
    }
  }

  console.log(str.reverse().join("\n"));
};
