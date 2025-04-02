# Cuentos - AI Powered Storybooks for Children

Cuentos is a responsive web application that creates personalized children's storybooks using AI. The application generates unique stories and illustrations based on user preferences, allowing for a customized storytelling experience.

## Features

- **User Input Form**: Capture child's name, preferred story theme, and illustration style
- **AI-Generated Content**: Create unique stories using OpenAI's GPT-4o model
- **AI-Generated Illustrations**: Generate matching illustrations for each page of the story
- **PDF Generation**: Convert the generated content into downloadable PDF storybooks
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Technologies Used

- **Frontend**: Next.js with React and TypeScript
- **Styling**: Tailwind CSS
- **AI Integration**: OpenAI API (GPT-4o)
- **PDF Generation**: pdf-lib

## Getting Started

### Prerequisites

- Node.js 18.0.0 or later
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/cuentos.git
   cd cuentos
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory and add your OpenAI API key:
   ```
   NEXT_PUBLIC_OPENAI_API_KEY=your_openai_api_key
   ```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Usage

1. Enter the child's name
2. Select a story theme (moral lessons, social skills, educational, fantasy)
3. Choose an illustration style
4. Click "Create My Storybook"
5. Wait for the AI to generate content
6. Preview the generated storybook
7. Download as PDF

## Future Enhancements

- User accounts for saving generated stories
- More customization options (age range, additional themes)
- Audio narration of stories
- Print-on-demand integration
- Multiple children characters in the same story

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

This is an MVP (Minimum Viable Product) version of Cuentos. Future updates will include more features and improvements.
