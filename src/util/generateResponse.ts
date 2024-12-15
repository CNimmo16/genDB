import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { z, ZodType } from "zod";
import actionWithLoading from "./actionWithLoading.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function generateResponse<T extends ZodType>(
  messages: ChatCompletionMessageParam[],
  validator: T,
  dataDesc: string,
  options: Omit<
    Parameters<typeof openai.beta.chat.completions.parse>[0],
    "messages"
  > = {
    model: "gpt-4o-mini",
  },
): Promise<{
  response: z.infer<T>;
}> {
  const {
    choices: [
      {
        message: { parsed },
      },
    ],
  } = await openai.beta.chat.completions.parse({
    messages,
    response_format: zodResponseFormat(
      validator,
      `${dataDesc}_response_format`,
    ),
    ...options,
  });

  if (!parsed) {
    throw new Error("Failed to generate response");
  }

  return { response: parsed };
}
