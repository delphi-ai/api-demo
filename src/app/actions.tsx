"use server"

export async function getCloneDetails() {
  const apiKey = process.env.DELPHI_API_KEY
  const baseUri = process.env.DELPHI_API_BASE_URI

  if (!apiKey || !baseUri) {
    throw new Error('API key or base URI not found in environment variables')
  }

  const res = await fetch(`https://${baseUri}/clone`, {
    headers: {
      'x-api-key': apiKey,
    },
  })

  if (!res.ok) {
    throw new Error('Failed to fetch clone details')
  }

  return res.json()
}