import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { z, ZodType } from "zod";

const DEFAULT_MAX_TOKENS = 1000;

export default async function generateResponse<T extends ZodType>(
  messages: ChatCompletionMessageParam[],
  validator: T,
  dataDesc: string,
  options: Omit<
    Parameters<OpenAI["beta"]["chat"]["completions"]["parse"]>[0],
    "messages" | "model"
  > & {
    model?: Parameters<
      OpenAI["beta"]["chat"]["completions"]["parse"]
    >[0]["model"];
  } = {},
): Promise<{
  response: z.infer<T>;
  tokensUsed: number;
}> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const {
    usage,
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
    max_completion_tokens: DEFAULT_MAX_TOKENS,
    model: options.model ?? "gpt-4o-mini",
    ...options,
  });

  if (!parsed || !usage) {
    throw new Error("Failed to generate response");
  }

  return { response: parsed, tokensUsed: usage.total_tokens };
}
