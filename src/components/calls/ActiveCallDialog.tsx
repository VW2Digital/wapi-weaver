import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, Mic, MicOff, PhoneOff, Loader2 } from "lucide-react";
import { manageCall } from "@/lib/profile.functions";

interface ActiveCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  contactPhone: string;
  callId: string;
  phoneId: string;
}

export function ActiveCallDialog({
  open,
  onOpenChange,
  contactName,
  contactPhone,
  callId,
  phoneId,
}: ActiveCallDialogProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [duration, setDuration] = useState(0);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer de duração da chamada
  useEffect(() => {
    if (open) {
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setDuration(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [open]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleMute = () => {
    if (peerConnectionRef.current) {
      const senders = peerConnectionRef.current.getSenders();
      senders.forEach((sender) => {
        if (sender.track && sender.track.kind === "audio") {
          sender.track.enabled = !isMuted;
        }
      });
      setIsMuted(!isMuted);
    }
  };

  const handleEndCall = async () => {
    setIsEnding(true);
    try {
      await manageCall({
        phoneId,
        action: "terminate",
        callId,
      });
      cleanup();
      onOpenChange(false);
    } catch (error) {
      console.error("[CALL] Erro ao encerrar chamada:", error);
    } finally {
      setIsEnding(false);
    }
  };

  const cleanup = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="space-y-6 py-4">
            <div className="text-center space-y-3">
              <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Phone className="h-10 w-10 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold text-xl">{contactName}</h3>
                <p className="text-sm text-muted-foreground">{contactPhone}</p>
              </div>
              <div className="text-3xl font-mono font-light">
                {formatDuration(duration)}
              </div>
            </div>
            <div className="flex gap-4 justify-center">
              <Button
                variant={isMuted ? "destructive" : "outline"}
                size="lg"
                onClick={toggleMute}
                disabled={isEnding}
                className="flex-1"
              >
                {isMuted ? (
                  <MicOff className="h-5 w-5" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </Button>
              <Button
                variant="destructive"
                size="lg"
                onClick={handleEndCall}
                disabled={isEnding}
                className="flex-1"
              >
                {isEnding ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <PhoneOff className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />
    </>
  );
}