import { useState } from "react";

// Define available themes and styles
const THEMES = [
  {
    id: "moral",
    name: "Moral & Values",
    description:
      "Stories that teach important life lessons like honesty, kindness, or responsibility",
  },
  {
    id: "social",
    name: "Social Skills",
    description:
      "Stories about friendship, teamwork, and getting along with others",
  },
  {
    id: "knowledge",
    name: "Educational",
    description:
      "Stories that teach about the world, science, nature, space, and how things work",
  },
  {
    id: "fantasy",
    name: "Fantasy Adventure",
    description:
      "Imaginative stories with magical characters, creatures and enchanted worlds",
  },
];

const STYLES = [
  {
    id: "pixar",
    name: "Pixar-style",
    description:
      "3D animation style similar to Pixar movies with expressive characters",
  },
  {
    id: "disney",
    name: "Disney-classic",
    description:
      "Classic Disney animation style with enchanting, fairytale aesthetics",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    description:
      "Soft, dreamy watercolor paintings with gentle colors and artistic touches",
  },
  {
    id: "cartoon",
    name: "Cartoon",
    description:
      "Bright, fun cartoon-style illustrations with bold outlines and vibrant colors",
  },
  {
    id: "storybook",
    name: "Classic Storybook",
    description:
      "Traditional children's book illustrations with rich details and nostalgic feel",
  },
  {
    id: "minimalist",
    name: "Minimalist Modern",
    description:
      "Simple, clean designs with essential elements and contemporary styling",
  },
];

const LANGUAGES = [
  { id: "spanish", name: "Spanish" },
  { id: "english", name: "English" },
];

const AGE_RANGES = [
  { id: "toddler", name: "Toddler (1-3)" },
  { id: "early", name: "Early Childhood (4-6)" },
  { id: "middle", name: "Middle Childhood (7-9)" },
  { id: "older", name: "Older Children (10+)" },
];

interface StoryFormProps {
  onSubmit: (formData: StoryFormData) => void;
  isLoading: boolean;
}

export interface StoryFormData {
  childName: string;
  theme: string;
  style: string;
  age?: string;
  language: string;
  customPrompt?: string;
}

export default function StoryForm({ onSubmit, isLoading }: StoryFormProps) {
  const [formData, setFormData] = useState<StoryFormData>({
    childName: "",
    theme: "moral",
    style: "pixar",
    language: "spanish",
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mt-8">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
        Create Your Storybook
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="childName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Child's Name
          </label>
          <input
            type="text"
            id="childName"
            name="childName"
            value={formData.childName}
            onChange={handleChange}
            placeholder="Enter child's name"
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label
            htmlFor="language"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Language
          </label>
          <select
            id="language"
            name="language"
            value={formData.language}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
          >
            {LANGUAGES.map((language) => (
              <option key={language.id} value={language.id}>
                {language.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="theme"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Story Theme
          </label>
          <select
            id="theme"
            name="theme"
            value={formData.theme}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
          >
            {THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {THEMES.find((t) => t.id === formData.theme)?.description}
          </p>
        </div>

        <div>
          <label
            htmlFor="style"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Illustration Style
          </label>
          <select
            id="style"
            name="style"
            value={formData.style}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
          >
            {STYLES.map((style) => (
              <option key={style.id} value={style.id}>
                {style.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {STYLES.find((s) => s.id === formData.style)?.description}
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-indigo-600 hover:text-indigo-500 flex items-center focus:outline-none dark:text-indigo-400"
          >
            {showAdvanced ? "Hide" : "Show"} Advanced Options
            <svg
              className={`ml-1.5 h-4 w-4 transition-transform ${
                showAdvanced ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div>
              <label
                htmlFor="age"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Age Range
              </label>
              <select
                id="age"
                name="age"
                value={formData.age}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select age range (optional)</option>
                {AGE_RANGES.map((range) => (
                  <option key={range.id} value={range.id}>
                    {range.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                This helps adjust vocabulary and complexity
              </p>
            </div>

            <div>
              <label
                htmlFor="customPrompt"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Custom Theme (Optional)
              </label>
              <textarea
                id="customPrompt"
                name="customPrompt"
                rows={3}
                value={formData.customPrompt || ""}
                onChange={handleChange}
                placeholder="Enter a custom theme prompt (overrides theme selection)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
        >
          {isLoading ? "Creating Story..." : "Create My Storybook"}
        </button>
      </form>
    </div>
  );
}
