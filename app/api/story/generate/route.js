import OpenAI from "openai";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to sanitize content to help avoid policy violations
function sanitizeContent(content) {
  if (!content) return content;

  // Remove potentially problematic content that could trigger content filters
  const sanitized = content
    .replace(/violent|explicit|graphic|inappropriate/gi, "gentle")
    .replace(/kill|harm|hurt|weapon/gi, "interact with");

  return sanitized;
}

// Helper function to log detailed API errors
function logApiError(requestId, error) {
  console.error(`[${requestId}] ❌ API Error Details:`);

  if (error.status) {
    console.error(`[${requestId}] Status: ${error.status}`);
  }

  if (error.code) {
    console.error(`[${requestId}] Error Code: ${error.code}`);
  }

  if (error.type) {
    console.error(`[${requestId}] Error Type: ${error.type}`);
  }

  if (error.param) {
    console.error(`[${requestId}] Error Param: ${error.param}`);
  }

  if (error.request_id) {
    console.error(`[${requestId}] OpenAI Request ID: ${error.request_id}`);
  }

  if (error.error?.message) {
    console.error(`[${requestId}] Error Message: ${error.error.message}`);
  }
}

export async function POST(request) {
  const requestId =
    Date.now().toString(36) + Math.random().toString(36).substr(2);
  console.log(`[${requestId}] 🔄 Story generation task started`);

  try {
    const {
      childName,
      age,
      theme,
      customPrompt,
      language = "spanish",
    } = await request.json();
    console.log(
      `[${requestId}] 📝 Parameters received: childName=${childName}, age=${age}, theme=${theme}, language=${language}`
    );

    if (!childName) {
      console.log(`[${requestId}] ❌ Error: Child name is required`);
      return Response.json(
        { error: "Child name is required" },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const sanitizedChildName = sanitizeContent(childName);
    const sanitizedCustomPrompt = sanitizeContent(customPrompt);

    // If content was sanitized, log it
    if (sanitizedChildName !== childName) {
      console.log(
        `[${requestId}] ⚠️ Child name was sanitized to avoid policy violations`
      );
    }

    if (sanitizedCustomPrompt !== customPrompt) {
      console.log(
        `[${requestId}] ⚠️ Custom prompt was sanitized to avoid policy violations`
      );
    }

    // Determine language for story generation
    const storyLanguage = language === "english" ? "English" : "Spanish";
    console.log(
      `[${requestId}] 🌐 Story will be generated in ${storyLanguage}`
    );

    // Parse age range
    let agePrompt = "";
    if (age === "1-4") {
      agePrompt = "for a toddler aged 1-4 years";
    } else if (age === "4-7") {
      agePrompt = "for an early reader aged 4-7 years";
    } else if (age === "7-10") {
      agePrompt = "for an independent reader aged 7-10 years";
    } else {
      agePrompt = "for children";
    }

    // Prepare the system message based on the theme
    let themePrompt = "";
    switch (theme) {
      case "moral-values":
        themePrompt =
          "Moral values focusing on character growth through ethical choices. The story should illustrate important virtues such as honesty, kindness, responsibility, respect, or fairness. Include a clear moral dilemma appropriate for the child's age, and show how making the right choice leads to positive outcomes. The lesson should be conveyed through the story's events rather than explicit preaching, allowing the child to understand the value through the character's experience.";
        break;
      case "social-education":
        themePrompt =
          "Social education emphasizing interpersonal skills and emotional intelligence. The story should explore concepts such as friendship, teamwork, empathy, conflict resolution, or inclusion. The main character should face a social challenge (like making friends, resolving a disagreement, or understanding someone different), and learn to navigate it successfully. Include realistic dialogue and age-appropriate social situations that children can relate to and learn from.";
        break;
      case "knowledge-building":
        themePrompt =
          "Educational content about science, nature, space, animals, or other fascinating subjects presented through an engaging narrative. The story should weave accurate, age-appropriate facts into an entertaining plot where the main character discovers or explores something new. The educational content should feel natural within the story, sparking curiosity and a love of learning. Include 3-5 interesting facts that would fascinate a child of the specified age.";
        break;
      case "fantasy-adventure":
        themePrompt =
          "An imaginative fantasy adventure with magical elements, creative settings, and an engaging quest or journey. The story should transport the child to a wondrous world with fantastical elements (like magical creatures, enchanted objects, or special abilities) while maintaining a clear narrative arc with age-appropriate challenges. The adventure should encourage creativity, bravery, and problem-solving, with the main character growing through their experiences in this magical realm.";
        break;
      default:
        themePrompt =
          "A fun and educational story with engaging characters and a meaningful message appropriate for the child's age.";
    }
    console.log(`[${requestId}] 📋 Theme prompt prepared: ${themePrompt}`);

    // Include custom prompt if provided
    const additionalPrompt = sanitizedCustomPrompt
      ? `Additional considerations: ${sanitizedCustomPrompt}`
      : "";

    console.log(`[${requestId}] 🤖 Calling GPT API to generate story...`);
    try {
      // Generate the story using GPT-4o
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional children's book author. Create a short story in ${storyLanguage} ${agePrompt} featuring a main character named ${sanitizedChildName}. 
            The story should have a plot related to: ${themePrompt}. 
            ${additionalPrompt}
            
            The story should have:
            1. An engaging title
            2. An introduction that presents the main character and setting
            3. A development with a problem or challenge
            4. A resolution that teaches a lesson related to the theme
            5. A happy ending
            
            The story must be divided into exactly 8 pages (including the introduction and ending).
            
            Format the response as a JSON object with the following format:
            {
              "title": "Story Title",
              "coverDescription": "Detailed description to generate a cover illustration",
              "pages": [
                {
                  "pageNumber": 1,
                  "content": "Text for page 1",
                  "imageDescription": "Detailed description to generate an illustration for this page"
                },
                ...more pages...
              ]
            }
            
            The image descriptions should be detailed and visual, including:
            - Characters present (appearance, expressions, poses)
            - Setting (location, time, environmental elements)
            - Main actions occurring
            - Important elements for the plot
            - General atmosphere and emotional tone
            
            IMPORTANT: Ensure the text for each page is brief (maximum 3-4 sentences) so it fits well in an illustration.
            
            IMPORTANT: Adjust the language complexity to be age-appropriate:
            - For 1-4 years: Use very simple words and short sentences.
            - For 4-7 years: Use straightforward language with some new vocabulary.
            - For 7-10 years: Use more complex sentences and richer vocabulary.
            
            IMPORTANT: Avoid content that could violate OpenAI's content policy. Keep all content child-friendly and appropriate.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });
      console.log(`[${requestId}] ✅ GPT API response received successfully`);
      console.log(
        `[${requestId}] 📊 Token usage: ${JSON.stringify({
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        })}`
      );

      // Parse the response
      console.log(`[${requestId}] 🔍 Parsing story data from response`);
      const storyData = JSON.parse(completion.choices[0].message.content);

      // Validate the response structure
      if (
        !storyData.title ||
        !storyData.coverDescription ||
        !storyData.pages ||
        !Array.isArray(storyData.pages)
      ) {
        console.error(`[${requestId}] ❌ Invalid response format from GPT API`);
        return Response.json(
          { error: "Failed to generate a valid story format" },
          { status: 500 }
        );
      }

      // Sanitize the story data to prevent content policy violations in image generation
      storyData.title = sanitizeContent(storyData.title);
      storyData.coverDescription = sanitizeContent(storyData.coverDescription);

      storyData.pages = storyData.pages.map((page) => ({
        ...page,
        content: sanitizeContent(page.content),
        imageDescription: sanitizeContent(page.imageDescription),
      }));

      console.log(
        `[${requestId}] 📚 Story generated with title: "${storyData.title}" (${storyData.pages.length} pages)`
      );

      // Return the story data
      console.log(
        `[${requestId}] ✅ Story generation task completed successfully`
      );
      return Response.json(storyData);
    } catch (apiError) {
      console.error(`[${requestId}] ❌ Error calling GPT API:`, apiError);
      logApiError(requestId, apiError);

      let errorMessage = "Failed to generate story";
      if (apiError.code === "content_policy_violation") {
        errorMessage =
          "Failed to generate story due to content policy violation. Please try a different prompt or theme.";
      }

      return Response.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    console.error(`[${requestId}] ❌ Error generating story:`, error);

    // Log detailed error information when available
    if (error.response?.data || error.code || error.status) {
      logApiError(requestId, error);
    }

    return Response.json(
      { error: "Failed to generate story" },
      { status: 500 }
    );
  }
}
