import Link from "next/link";

export default function Header() {
  return (
    <header className="w-full py-4 px-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-3xl">📚</span>
          <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            Cuentos
          </h1>
        </Link>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          AI-Powered Storybooks for Children
        </div>
      </div>
    </header>
  );
}
