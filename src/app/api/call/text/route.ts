import { NextRequest, NextResponse } from 'next/server'
import { EventSourceParserStream } from 'eventsource-parser/stream'

export async function GET(req: NextRequest) {
  const params = await req.nextUrl.searchParams;

  const call_id = params.get('call_id');
  const message = params.get('message');

  const apiKey = process.env.DELPHI_API_KEY
  const baseUrl = process.env.DELPHI_API_BASE_URI

  if (!apiKey || !baseUrl) {
    return NextResponse.json({ error: 'API key or base URL not found' }, { status: 500 })
  }

  const url = `https://${baseUrl}/interaction/call/respond`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      call_id: call_id,
      text: message
    })
  })

  if (!response.ok) {
    console.log('Response body:', response.body)
    return NextResponse.json({ error: 'Failed to connect to Delphi API' }, { status: response.status })
  }

  const stream = response.body
  if (!stream) {
    return NextResponse.json({ error: 'No stream found' }, { status: 500 })
  }
  
  // Create a TransformStream to process the events
  const transformStream = new TransformStream({
    transform(chunk, controller) {
      // Parse the event data
      const event = JSON.parse(chunk.data);
      const encoder = new TextEncoder();
      const processedData = JSON.stringify(event);
      controller.enqueue(encoder.encode('data: ' + processedData + '\n\n'));
    }
  });

  // Create the event stream
  const eventStream = stream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
    .pipeThrough(transformStream);

  return new Response(eventStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });

}
