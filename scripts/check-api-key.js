// This script checks if the OpenAI API key is set correctly
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🚀 Starting API key check script...");

function checkApiKey() {
  console.log("🔑 Checking OpenAI API Key status...");

  // 1. Check environment variables for existing key
  const openaiKey =
    process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;

  if (openaiKey) {
    console.log("✅ OpenAI API key found in environment variables.");

    // Show masked key for verification
    console.log(
      `API Key: ${openaiKey.substring(0, 3)}${"*".repeat(
        Math.max(0, openaiKey.length - 6)
      )}${openaiKey.substring(openaiKey.length - 3)}`
    );
    return true;
  } else {
    console.log("❌ No OpenAI API key found in environment variables.");
  }

  // 2. Check .env.local file if it exists
  const envPath = path.join(__dirname, "..", ".env.local");
  console.log(`Checking for .env.local file at: ${envPath}`);

  if (fs.existsSync(envPath)) {
    console.log("📄 Found .env.local file. Checking for API key...");

    const envContent = fs.readFileSync(envPath, "utf8");
    console.log("ENV file content:", envContent);

    const openaiKeyMatch = envContent.match(/OPENAI_API_KEY=([^\r\n]+)/);
    const publicKeyMatch = envContent.match(
      /NEXT_PUBLIC_OPENAI_API_KEY=([^\r\n]+)/
    );

    console.log("Regex matches:", { openaiKeyMatch, publicKeyMatch });

    if (openaiKeyMatch || publicKeyMatch) {
      const foundKey =
        (openaiKeyMatch && openaiKeyMatch[1]) ||
        (publicKeyMatch && publicKeyMatch[1]);

      if (foundKey && foundKey !== "your_openai_api_key_here") {
        console.log(
          "✅ OpenAI API key found in .env.local file, but not loaded in environment."
        );
        console.log(
          "You need to restart your development server for changes to take effect."
        );

        // Show masked key for verification
        console.log(
          `API Key: ${foundKey.substring(0, 3)}${"*".repeat(
            Math.max(0, foundKey.length - 6)
          )}${foundKey.substring(foundKey.length - 3)}`
        );
        return true;
      } else {
        console.log("❌ API key in .env.local is set to placeholder value.");
      }
    } else {
      console.log("❌ No OpenAI API key found in .env.local file.");
    }
  } else {
    console.log("❌ No .env.local file found. Creating one...");

    // Create example .env.local file
    const exampleEnv = `# OpenAI API Key - Add your key here
# For server components and API routes:
OPENAI_API_KEY=your_openai_api_key_here

# For client components (less secure, only use for development):
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here

# Note: For production, only use OPENAI_API_KEY with server components and API routes.
# The NEXT_PUBLIC_ prefix exposes the variable to the browser, which is less secure.
`;

    fs.writeFileSync(envPath, exampleEnv);
    console.log(
      "📝 Created example .env.local file. Please edit it to add your OpenAI API key."
    );
  }

  console.log("\n❓ How to get an OpenAI API key:");
  console.log("1. Go to https://platform.openai.com/");
  console.log("2. Sign up or log in to your account");
  console.log("3. Navigate to https://platform.openai.com/api-keys");
  console.log("4. Create a new API key");
  console.log("5. Copy the key and add it to your .env.local file");
  console.log(
    "\n🔄 After adding your API key, restart your development server with:"
  );
  console.log("   npm run dev");

  return false;
}

// Run the check
const result = checkApiKey();
console.log(`Check completed with result: ${result}`);
