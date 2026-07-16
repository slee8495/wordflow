import { convertToModelMessages, streamText, stepCountIs, UIMessage } from "ai";
import { CHAT_MODEL, webSearchTool } from "@/lib/ai/model";
import { getTodayReading, recommendWorship } from "@/lib/ai/chatTools";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: CHAT_MODEL,
    system:
      "You are the assistant inside 'Wordflow', a personal daily Bible reading app. " +
      "You answer questions about the Bible, church, pastors, Christian books, and today's reading, and recommend worship songs. " +
      "Reply in whichever language the user writes in (Korean or English), matching their language unless asked to switch. " +
      "Use getTodayReading when the user asks about 'today's passage/reading'. Use recommendWorship when they want a worship song recommendation. " +
      "Use web search for facts about specific pastors, churches, or recent sermons/books you're not certain about — don't guess. " +
      "Keep answers warm and conversational, not preachy or academic.",
    messages: await convertToModelMessages(messages),
    tools: { getTodayReading, recommendWorship, webSearch: webSearchTool() },
    stopWhen: stepCountIs(6),
  });

  return result.toUIMessageStreamResponse();
}
