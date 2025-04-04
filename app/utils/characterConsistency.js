/**
 * Character Consistency Utilities
 *
 * This module provides functions to help maintain consistent character appearance
 * across multiple DALL-E image generations.
 */

/**
 * Creates a detailed character profile prompt for initial generation
 * @param {string} characterName - The name of the character
 * @returns {string} - A detailed prompt for GPT to create a consistent character profile
 */
export function createCharacterProfilePrompt(characterName) {
  return `Create a detailed character profile for a children's book protagonist named ${characterName}. 
The profile must include EXHAUSTIVE details to ensure consistency across all illustrations.

Physical attributes (be extremely specific):
- Age: Exact age (e.g., "7-year-old")
- Gender/presentation: How the character presents
- Ethnicity/skin tone: Detailed description of skin color and tone
- Hair: Exact color, length, style, texture (e.g., "sandy brown hair in a neat undercut")
- Eyes: Shape, color, distinctive features (e.g., "almond-shaped hazel eyes")
- Face shape: Detailed description of facial structure
- Body type: Build, height relative to age
- Distinctive features: Any unique marks, freckles, dimples, etc.

Clothing and accessories (provide exact details):
- Main outfit: All clothing items with exact colors and style
- Signature items: Any accessories or items always worn
- Color palette: Consistent color scheme for the character

Include 3-5 unique, memorable features that make this character instantly recognizable and should appear in EVERY illustration.

Format the profile as a structured list with categories and specific details that can be directly copied into every image prompt.`;
}

/**
 * Formats a character profile for consistent use in image prompts
 * @param {string} characterProfile - The character profile text
 * @returns {string} - A formatted character prompt ready for DALL-E
 */
export function formatConsistentCharacterPrompt(characterProfile) {
  return `CHARACTER PROFILE (MUST BE FOLLOWED EXACTLY IN EVERY DETAIL):
${characterProfile}

CRITICAL CONSISTENCY REQUIREMENTS:
1. Maintain EXACT consistency with all physical attributes described above
2. Use the SAME unique features in every illustration
3. Keep clothing and accessories identical unless explicitly stated otherwise
4. Maintain the same color palette for the character across all illustrations
5. Render the character in the SAME art style and proportions throughout`;
}

/**
 * Creates a character reference sheet prompt
 * @param {string} characterName - The name of the character
 * @param {string} characterProfile - The character profile text
 * @param {string} stylePrompt - The style of illustration
 * @returns {string} - A prompt for generating a character reference sheet
 */
export function createCharacterReferencePrompt(
  characterName,
  characterProfile,
  stylePrompt
) {
  const consistentCharacterPrompt =
    formatConsistentCharacterPrompt(characterProfile);

  return `Create a detailed CHARACTER REFERENCE SHEET for a children's book protagonist named ${characterName} ${stylePrompt}.

PURPOSE: This reference sheet will be used to maintain PERFECT VISUAL CONSISTENCY of the character across ALL illustrations in the book.

${consistentCharacterPrompt}

CRITICAL REQUIREMENTS:
1. Show the character CLEARLY from the FRONT view in a neutral pose
2. Include a CLOSE-UP of the character's face showing all facial details
3. Display the character's full outfit and all accessories mentioned
4. Include visual references for the character's unique features
5. Use a PLAIN, SIMPLE background that doesn't distract from the character
6. The character must appear EXACTLY as described above with NO variations
7. NO text labels should appear in the image
8. This is a REFERENCE SHEET showing what the character looks like, not a storybook illustration`;
}

/**
 * Creates a consistent cover image prompt
 * @param {string} title - Book title
 * @param {string} coverDescription - Description of the cover scene
 * @param {string} characterProfile - The character profile text
 * @param {string} styleDescription - The style of illustration
 * @param {string} mainCharacter - The character's name
 * @param {string} additionalInstructions - Optional additional instructions
 * @returns {string} - A prompt for generating a cover image
 */
export function createCoverImagePrompt(
  title,
  coverDescription,
  characterProfile,
  styleDescription,
  mainCharacter,
  additionalInstructions = ""
) {
  const consistentCharacterPrompt =
    formatConsistentCharacterPrompt(characterProfile);

  return `Create a front cover illustration for a children's book titled "${title}", ${styleDescription}.
${coverDescription}

${consistentCharacterPrompt}

CRITICAL REQUIREMENTS:
1. Do NOT include ANY text in the illustration
2. NO words, lettering, labels, or text elements of any kind should appear
3. Create a direct illustration, NOT a photograph or meta-representation of a book
4. Character ${mainCharacter} MUST be rendered with 100% consistency to the profile above
${
  additionalInstructions
    ? `\nADDITIONAL INSTRUCTIONS:\n${additionalInstructions}`
    : ""
}`;
}

/**
 * Creates a consistent page illustration prompt
 * @param {number} pageNumber - The page number
 * @param {string} imageDescription - Description of the scene
 * @param {string} characterProfile - The character profile text
 * @param {string} styleDescription - The style of illustration
 * @param {string} mainCharacter - The character's name
 * @param {string} additionalInstructions - Optional additional instructions
 * @returns {string} - A prompt for generating a page illustration
 */
export function createPageImagePrompt(
  pageNumber,
  imageDescription,
  characterProfile,
  styleDescription,
  mainCharacter,
  additionalInstructions = "IMAGE SHOULD ABSOLUTELY NOT CONTAIN ANY TEXT."
) {
  const consistentCharacterPrompt =
    formatConsistentCharacterPrompt(characterProfile);

  return `Create an illustration for page ${pageNumber} of a children's story-book ${styleDescription}.

Scene description:
${imageDescription}

${consistentCharacterPrompt}

CRITICAL REQUIREMENTS:
1. Do NOT include ANY text in the illustration
2. NO words, lettering, labels, or text elements of any kind should appear
3. Create a direct illustration, NOT a photograph or meta-representation of a book
4. Character ${mainCharacter} MUST match EXACTLY the character profile above with no deviations
${
  additionalInstructions
    ? `\nADDITIONAL INSTRUCTIONS:\n${additionalInstructions}`
    : ""
}`;
}
