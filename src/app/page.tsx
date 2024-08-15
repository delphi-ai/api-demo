import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-8">Delphi External API Demo Application</h1>
      <Link href="/call" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        Call
      </Link>
    </main>
  )
}