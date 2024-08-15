'use server'

export interface StartCallResponse {
  call_id: string;
  greeting_audio: string;
}

export async function startCall(): Promise<StartCallResponse> {
  const apiKey = process.env.DELPHI_API_KEY
  const baseUrl = process.env.DELPHI_API_BASE_URI

  if (!apiKey || !baseUrl) {
    throw new Error('API key or base URL not found in environment variables')
  }

  try {
    const response = await fetch(`https://${baseUrl}/interaction/call/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      // body: JSON.stringify({ user_email: 'sam@delphi.ai' })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error(errorData)
      throw new Error(`Failed to start call: ${response.status}`)
    }

    const data = await response.json() as StartCallResponse
    // console.log(data)

    return {
      call_id: data.call_id,
      greeting_audio: data.greeting_audio
    }
  } catch (error) {
    console.error('Error in startCall:', error)
    throw error
  }
}