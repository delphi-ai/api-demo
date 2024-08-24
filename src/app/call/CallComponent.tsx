'use client'

import { useState, useRef, useEffect } from 'react'
import { startCall, StartCallResponse, endCall } from './actions'
import { Volume2, VolumeX, Send } from 'lucide-react'
import { EventSourcePolyfill } from 'event-source-polyfill'

interface AudioChunk {
  event: string
  audio: string
}

export default function CallComponent() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<StartCallResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [responseAudio, setResponseAudio] = useState<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const audioBufferQueueRef = useRef<Float32Array[]>([])
  const isPlayingRef = useRef(false)

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const handleStartCall = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const response = await startCall()
      setResult(response)
      await decodeAudio(response.greeting_audio)
      playAudio(response.greeting_audio)
    } catch (error) {
      setError('Error occurred during the call')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const decodeAudio = async (base64Audio: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    const audioData = base64ToFloat32Array(base64Audio)
    const audioBuffer = audioContextRef.current.createBuffer(1, audioData.length, 44100)
    audioBuffer.getChannelData(0).set(audioData)
    return audioBuffer
  }

  const base64ToFloat32Array = (base64: string) => {
    const binaryString = window.atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const int16Array = new Int16Array(bytes.buffer)
    const float32Array = new Float32Array(int16Array.length)
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0
    }
    return float32Array
  }

  const playAudio = async (audioData: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    const audioBuffer = await decodeAudio(audioData)
    audioBufferRef.current = audioBuffer

    audioSourceRef.current = audioContextRef.current.createBufferSource()
    audioSourceRef.current.buffer = audioBuffer
    audioSourceRef.current.connect(audioContextRef.current.destination)
    audioSourceRef.current.onended = () => setIsPlaying(false)
    audioSourceRef.current.start()
    setIsPlaying(true)
  }

  const stopAudio = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop()
      setIsPlaying(false)
    }
  }

  const handleEndCall = async () => {
    if (result) {
      setIsLoading(true)
      try {
        await endCall(result.call_id)
        setIsSending(false)
        stopAudio()
        setResult(null)
        setError(null)
        setIsPlaying(false)
        setMessage('')
        audioBufferRef.current = null
      } catch (error) {
        setError('Error occurred while ending the call')
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleSendMessage = async () => {
    if (result && message.trim()) {
      setIsSending(true)
      setError(null)
      setResponseAudio(null)
      audioBufferQueueRef.current = []

      const queryString = new URLSearchParams({
        call_id: result.call_id,
        message: message.trim(),
      }).toString();
      const url = `/api/respond?${queryString}`;
    
      const eventSource = new EventSourcePolyfill(url, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
      });

      eventSource.onopen = () => {
        console.log('Connection to SSE stream opened');
      };
    
      eventSource.onmessage = (event: MessageEvent) => {
        try {
          const parsedData: AudioChunk = JSON.parse(event.data);
          console.log('Received event:', parsedData);
          if (parsedData.event == 'stream-end'){
            eventSource.close()
            setIsSending(false)
            setMessage('')
          }
          if (parsedData.event == 'audio-chunk'){
            const audioData = base64ToFloat32Array(parsedData.audio)
            audioBufferQueueRef.current.push(audioData)
            if (!isPlayingRef.current) {
              playNextChunk()
            }
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };
    
      eventSource.onerror = (error: any) => {
        console.error('SSE stream error:', error);
        eventSource.close();
      };
    }
  }

  const playNextChunk = async () => {
    if (audioBufferQueueRef.current.length > 0 && audioContextRef.current) {
      isPlayingRef.current = true
      const chunk = audioBufferQueueRef.current.shift()!
      const audioBuffer = audioContextRef.current.createBuffer(1, chunk.length, 44100)
      audioBuffer.getChannelData(0).set(chunk)

      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContextRef.current.destination)
      source.onended = () => {
        if (audioBufferQueueRef.current.length > 0) {
          playNextChunk()
        } else {
          isPlayingRef.current = false
        }
      }
      source.start()
      setIsPlaying(true)
    } else {
      isPlayingRef.current = false
      setIsPlaying(false)
    }
  }

return (
    <div className="flex flex-col items-center">
      {!result ? (
        <button
          onClick={handleStartCall}
          disabled={isLoading}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          {isLoading ? 'Starting Call...' : 'Start Call'}
        </button>
      ) : (
        <button
          onClick={handleEndCall}
          disabled={isLoading}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          {isLoading ? 'Ending Call...' : 'End Call'}
        </button>
      )}
      {error && <p className="mt-4 text-red-500">{error}</p>}
      {result && (
        <div className="mt-4 text-center">
          <p className="font-bold text-green-600">Success! Call started.</p>
          <p className="mt-2">Call ID: {result.call_id}</p>
          <div className="mt-4 flex items-center justify-center">
            <p className="mr-2">Click to play greeting message:</p>
            <button
              onClick={isPlaying ? stopAudio : () => playAudio(result.greeting_audio)}
              className={`p-2 rounded-full ${isPlaying ? 'bg-red-500 hover:bg-red-700' : 'bg-blue-500 hover:bg-blue-700'}`}
              disabled={!result.greeting_audio}
            >
              {isPlaying ? <VolumeX size={24} color="red" /> : <Volume2 size={24} color="black" />}
            </button>
          </div>
          <div className="mt-4">
            <p className="mb-2 font-bold">Type a message:</p>
            <div className="flex items-center">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex-grow px-3 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your message..."
                disabled={isSending}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || isSending}
                className={`px-4 py-2 rounded-r-md ${
                  message.trim() && !isSending
                    ? 'bg-blue-500 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSending ? 'Sending...' : <Send size={20} />}
              </button>
            </div>
          </div>
          {responseAudio && (
            <div className="mt-4">
              <p className="mb-2 font-bold">Response received:</p>
              <button
                onClick={isPlaying ? stopAudio : () => playAudio(responseAudio)}
                className={`p-2 rounded-full ${isPlaying ? 'bg-red-500 hover:bg-red-700' : 'bg-blue-500 hover:bg-blue-700'}`}
              >
                {isPlaying ? <VolumeX size={24} color="white" /> : <Volume2 size={24} color="white" />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )

}