'use client'

import React, { useState, useRef, useEffect } from 'react'
import { startCall, StartCallResponse, endCall } from './actions'
import { Volume2, VolumeX, Send, Mic, StopCircle } from 'lucide-react'
import { EventSourcePolyfill } from 'event-source-polyfill'
import { base64ToFloat32Array, arrayBufferToBase64 } from './utils'

interface AudioChunk {
  event: string
  audio: string
}

export default function CallComponent() {
  const [isLoading, setIsLoading] = useState(false)
  const [callInfo, setCallInfo] = useState<StartCallResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const audioBufferQueueRef = useRef<Float32Array[]>([])
  const isPlayingRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const handleStartCall = async () => {
    setIsLoading(true)
    setError(null)
    setCallInfo(null)
    try {
      const response = await startCall()
      setCallInfo(response)
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
    if (callInfo) {
      setIsLoading(true)
      try {
        await endCall(callInfo.call_id)
        setIsSending(false)
        stopAudio()
        setCallInfo(null)
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

  // Two examples of how you could send a message to the Delphi API.
  const handleSendTextMessage = async () => {
    if (callInfo && message.trim()) {
      setIsSending(true)
      setError(null)
      audioBufferQueueRef.current = []

      const queryString = new URLSearchParams({
        call_id: callInfo.call_id,
        message: message.trim(),
      }).toString();
      const url = `/api/call/text?${queryString}`;
    
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

  const handleSendAudioMessage = async () => {
    if (callInfo && audioBlob) {
      console.log('Sending audio blob:', audioBlob)
      try { 
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64Audio = arrayBufferToBase64(arrayBuffer);
        const response = await fetch(`/api/call/audio`, {
          method: 'POST',
          headers: {
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            call_id: callInfo.call_id,
            audio: base64Audio
          })
        });
        
        if (!response.ok || !response.body) {
          throw new Error('Failed to connect to Delphi API');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          
          // Process all complete events
          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i];
            if (line.startsWith('data: ')) {
              try {
                const parsedData: AudioChunk = JSON.parse(line.slice(6));
                console.log('Received event:', parsedData);
                if (parsedData.event == 'audio-chunk'){
                  const audioData = base64ToFloat32Array(parsedData.audio)
                  audioBufferQueueRef.current.push(audioData)
                  if (!isPlayingRef.current) {
                    playNextChunk()
                  }
                }
              } catch (parseError) {
                console.error('Error parsing event data:', parseError);
              }
            }
          }
          
          // Keep the last potentially incomplete event in the buffer
          buffer = lines[lines.length - 1];
        }
      } catch (error) {
        console.error('Error:', error);
        // Handle errors here
      }
      setAudioBlob(null);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      
      const audioChunks: Blob[] = []
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunks.push(event.data)
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
        setAudioBlob(audioBlob)
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      setError('Error accessing microphone')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  return (
    <div className="flex flex-col items-center">
      {!callInfo ? (
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
      {callInfo && (
        <div className="mt-4 text-center">
          <p className="font-bold text-green-600">Success! Call started.</p>
          <p className="mt-2">Call ID: {callInfo.call_id}</p>
          <div className="mt-4">
            <p className="mb-2 font-bold"><b>Type a message:</b></p>
            <div className="flex items-center">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex-grow px-3 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your message..."
                disabled={isSending || isRecording}
              />
              <button
                onClick={handleSendTextMessage}
                disabled={!message.trim() || isSending || isRecording}
                className={`px-4 py-2 rounded-r-md ${
                  message.trim() && !isSending && !isRecording
                    ? 'bg-blue-500 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSending ? 'Sending...' : <Send size={20} />}
              </button>
              <p>In your application you could have the user type a message, or use a transcriber like Deepgram to convert audio to text. Transcribing in real time will save ~1 second of latency, because then the API doens't have to transcribe your audio.</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 font-bold"><b>Record a message:</b></p>
            <div className="flex items-center justify-center space-x-2">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-2 rounded-full ${
                  isRecording ? 'bg-red-500 hover:bg-red-700' : 'bg-blue-500 hover:bg-blue-700'
                } text-white`}
              >
                {isRecording ? <StopCircle size={24} /> : <Mic size={24} />}
              </button>
              {audioBlob && (
                <button
                  onClick={handleSendAudioMessage}
                  className="px-4 py-2 bg-green-500 hover:bg-green-700 text-white rounded-md"
                >
                  Send Audio
                </button>
              )}
            </div>
          </div>
          <div>
          <div className="mt-15 flex items-center justify-center">
              {isPlaying ? <VolumeX size={24} color="red" /> : <Volume2 size={24} color="black" />}
          </div>

          </div>
        </div>
      )}
    </div>
  )
}