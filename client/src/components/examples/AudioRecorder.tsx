import AudioRecorder from '../AudioRecorder'

export default function AudioRecorderExample() {
  return (
    <div className="max-w-2xl p-6">
      <AudioRecorder 
        onRecordingComplete={(file) => console.log('Recording complete:', file)}
        onFileUpload={(file) => console.log('File uploaded:', file)}
      />
    </div>
  )
}
