import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, Square, Upload, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AudioRecorderProps {
  onRecordingComplete?: (audioFile: File) => void;
  onFileUpload?: (file: File) => void;
}

export default function AudioRecorder({ onRecordingComplete, onFileUpload }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const handleStartRecording = () => {
    console.log('Recording started');
    setIsRecording(true);
    const interval = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
    
    setTimeout(() => {
      clearInterval(interval);
    }, 60000);
  };

  const handleStopRecording = () => {
    console.log('Recording stopped');
    setIsRecording(false);
    setRecordingDuration(0);
    onRecordingComplete?.(new File([], 'recording.wav'));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('File uploaded:', file.name);
      onFileUpload?.(file);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card data-testid="card-audio-recorder">
      <CardContent className="p-6">
        <div className="text-center space-y-6">
          {!isRecording ? (
            <>
              <div className="flex flex-col items-center gap-4">
                <Button
                  size="lg"
                  className="w-32 h-32 rounded-full bg-accent hover:bg-accent text-accent-foreground"
                  onClick={handleStartRecording}
                  data-testid="button-start-recording"
                >
                  <Mic className="w-12 h-12" />
                </Button>
                <p className="text-sm text-muted-foreground">Click to start recording</p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-muted"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <div>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="audio-upload"
                  data-testid="input-audio-upload"
                />
                <label htmlFor="audio-upload">
                  <Button variant="outline" asChild data-testid="button-upload-audio">
                    <span className="cursor-pointer gap-2">
                      <Upload className="w-4 h-4" />
                      Upload Audio File
                    </span>
                  </Button>
                </label>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
                  <Mic className="w-12 h-12 text-destructive" />
                </div>
                <Badge className="absolute -top-2 -right-2 bg-destructive" data-testid="badge-recording">
                  Recording
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-2xl font-mono font-semibold" data-testid="text-recording-duration">
                  {formatDuration(recordingDuration)}
                </p>
                <p className="text-sm text-muted-foreground">Audio will be deleted after 24h</p>
              </div>

              <Button
                variant="destructive"
                size="lg"
                onClick={handleStopRecording}
                className="gap-2"
                data-testid="button-stop-recording"
              >
                <Square className="w-5 h-5" />
                Stop Recording
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
