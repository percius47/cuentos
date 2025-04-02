import { NextRequest } from "next/server";

// Define stages for the story generation process
const STAGES = [
  "Brainstorming story ideas",
  "Crafting the perfect narrative",
  "Developing unique characters",
  "Creating the story structure",
  "Writing engaging dialogues",
  "Designing character appearances",
  "Planning illustration concepts",
  "Creating visual descriptions",
  "Generating art prompts",
  "Crafting detailed illustrations",
  "Finalizing page layouts",
  "Polishing the final storybook",
];

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const customReadable = new ReadableStream({
    start(controller) {
      let counter = 0;

      // Send an update every 3 seconds
      const interval = setInterval(() => {
        if (counter < STAGES.length) {
          // Format data according to SSE spec
          const data = encoder.encode(
            `data: ${JSON.stringify({ stage: STAGES[counter] })}\n\n`
          );
          controller.enqueue(data);
          counter++;
        } else {
          clearInterval(interval);
          controller.close();
        }
      }, 3000);

      // Clean up if the client disconnects
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(customReadable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
