'use client'

import { useState, useRef, useEffect } from 'react'
import { startCall, StartCallResponse, endCall } from './actions'
import { Volume2, VolumeX } from 'lucide-react'

export default function StartCallButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<StartCallResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null)

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
    audioBufferRef.current = audioBuffer
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

  const playAudio = () => {
    if (!audioContextRef.current || !audioBufferRef.current) return

    audioSourceRef.current = audioContextRef.current.createBufferSource()
    audioSourceRef.current.buffer = audioBufferRef.current
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
        stopAudio()
        setResult(null)
        setError(null)
        setIsPlaying(false)
        audioBufferRef.current = null
      } catch (error) {
        setError('Error occurred while ending the call')
        console.error(error)
      } finally {
        setIsLoading(false)
      }
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
              onClick={isPlaying ? stopAudio : playAudio}
              className={`p-2 rounded-full ${isPlaying ? 'bg-red-500 hover:bg-red-700' : 'bg-blue-500 hover:bg-blue-700'}`}
              disabled={!audioBufferRef.current}
            >
              {isPlaying ? <VolumeX size={24} color="white" /> : <Volume2 size={24} color="white" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}