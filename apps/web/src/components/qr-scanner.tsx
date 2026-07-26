"use client";

import type { InventoryContainer, Room } from "@stuffhub/domain";
import jsQR from "jsqr";
import { Box, Check, Flashlight, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ScanState = "idle" | "lookup" | "success" | "invalid" | "unknown" | "error";

export function QrScanner({ containers, rooms, onClose, onOpen }: { containers: InventoryContainer[]; rooms: Room[]; onClose: () => void; onOpen: (containerId: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef<number | null>(null);
  const guard = useRef(false);
  const [state, setState] = useState<ScanState>("idle");
  const [resultId, setResultId] = useState<string | null>(null);
  const [liveCamera, setLiveCamera] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torch, setTorch] = useState(false);

  const stopCamera = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  const resolvePayload = async (payload: string) => {
    if (guard.current) return;
    guard.current = true;
    if (!/^stuffhub:\/\/container\/[0-9a-f-]{36}$/i.test(payload)) { setState("invalid"); return; }
    setState("lookup");
    const local = containers.find((entry) => entry.label?.payload === payload);
    try {
      let containerId = local?.id;
      if (!containerId) {
        const response = await fetch(`/api/labels/resolve?payload=${encodeURIComponent(payload)}`, { credentials: "include" });
        const body = await response.json() as { containerId?: string; error?: string };
        if (!response.ok || !body.containerId) throw new Error(body.error ?? "Label not found");
        containerId = body.containerId;
      }
      setResultId(containerId);
      setState("success");
      stopCamera();
      if (navigator.vibrate) navigator.vibrate(70);
    } catch (error) {
      setState(error instanceof Error && /not found/i.test(error.message) ? "unknown" : "error");
    }
  };

  const inspectCanvas = () => {
    const source = video.current;
    const target = canvas.current;
    if (!source || !target || guard.current) return;
    if (source.readyState >= 2 && source.videoWidth && source.videoHeight) {
      const width = 480;
      const height = Math.round(width * source.videoHeight / source.videoWidth);
      target.width = width; target.height = height;
      const context = target.getContext("2d", { willReadFrequently: true });
      context?.drawImage(source, 0, 0, width, height);
      const pixels = context?.getImageData(0, 0, width, height);
      const result = pixels ? jsQR(pixels.data, width, height, { inversionAttempts: "dontInvert" }) : null;
      if (result?.data) { void resolvePayload(result.data); return; }
    }
    frame.current = requestAnimationFrame(inspectCanvas);
  };

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setCameraBlocked(true); return; }
      try {
        const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
        stream.current = media;
        const track = media.getVideoTracks()[0];
        const capabilities = track?.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
        setTorchAvailable(Boolean(capabilities?.torch));
        if (video.current) { video.current.srcObject = media; await video.current.play(); setLiveCamera(true); frame.current = requestAnimationFrame(inspectCanvas); }
      } catch { if (!cancelled) setCameraBlocked(true); }
    };
    void start();
    return () => { cancelled = true; stopCamera(); };
  // Camera lifecycle intentionally runs once for this scanner instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decodePhoto = async (file?: File) => {
    if (!file) return;
    guard.current = false; setState("lookup");
    const uri = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Image could not be read")); image.src = uri; });
      const target = canvas.current; if (!target) throw new Error("Scanner is unavailable");
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      target.width = Math.round(image.naturalWidth * scale); target.height = Math.round(image.naturalHeight * scale);
      const context = target.getContext("2d", { willReadFrequently: true });
      context?.drawImage(image, 0, 0, target.width, target.height);
      const pixels = context?.getImageData(0, 0, target.width, target.height);
      const result = pixels ? jsQR(pixels.data, target.width, target.height, { inversionAttempts: "attemptBoth" }) : null;
      if (!result?.data) { setState("invalid"); return; }
      guard.current = false; await resolvePayload(result.data);
    } catch { setState("error"); } finally { URL.revokeObjectURL(uri); }
  };

  const reset = () => { guard.current = false; setResultId(null); setState("idle"); if (liveCamera) frame.current = requestAnimationFrame(inspectCanvas); };
  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0]; if (!track) return;
    const next = !torch;
    try { await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] }); setTorch(next); } catch { /* Unsupported by this camera. */ }
  };
  const result = resultId ? containers.find((entry) => entry.id === resultId) : undefined;
  const room = result ? rooms.find((entry) => entry.id === result.roomId) : undefined;

  return <section className="web-scanner" aria-label="QR code scanner">
    <video ref={video} className="web-scanner-video" playsInline muted />
    <canvas ref={canvas} hidden />
    <header className="web-scanner-header"><button onClick={onClose} aria-label="Close scanner"><X size={22} /></button><div><small>STUFFHUB</small><strong>Scan container</strong></div>{torchAvailable ? <button className={torch ? "active" : ""} onClick={() => void toggleTorch()} aria-label="Toggle flashlight"><Flashlight size={21} /></button> : <span />}</header>
    {!cameraBlocked ? <div className={`web-scanner-stage ${state === "success" ? "success" : ""}`}><div className="web-scanner-frame">{state === "success" ? <span><Check size={42} /></span> : <i />}</div><p>{state === "lookup" ? "Checking this label…" : state === "success" ? "Container found" : "Align the QR code within the frame."}</p></div> : null}
    {cameraBlocked && (state === "idle" || state === "lookup") ? <div className="scanner-permission"><span><QrCodeIcon /></span><h1>Scan a container label</h1><p>{window.isSecureContext ? "Camera access is unavailable. Take or choose a clear photo of the QR label instead." : "Live scanning requires HTTPS. On this local connection, take a clear photo of the QR label instead."}</p><label>Take QR photo<input hidden type="file" accept="image/*" capture="environment" onChange={(event) => void decodePhoto(event.target.files?.[0])} /></label><button onClick={onClose}>Not now</button></div> : null}
    {(state === "invalid" || state === "unknown" || state === "error") ? <div className="scanner-failure"><h2>{state === "invalid" ? "QR code not recognized" : state === "unknown" ? "Container not found" : "Couldn’t check the label"}</h2><p>{state === "invalid" ? "Use a clear photo of a StuffHub container label." : state === "unknown" ? "This label is not active in your home inventory." : "Check your connection and try again."}</p><button onClick={reset}><RotateCcw size={16} /> Try again</button>{cameraBlocked ? <label>Choose another photo<input hidden type="file" accept="image/*" capture="environment" onChange={(event) => void decodePhoto(event.target.files?.[0])} /></label> : null}</div> : null}
    {state === "success" && result ? <div className="scanner-result"><i /><div className="scanner-result-row"><span><Box size={27} /></span><div><small>CONTAINER FOUND</small><h2>{result.name}</h2><p>{room?.name ?? "Your home"}</p></div></div><button onClick={() => onOpen(result.id)}>Open container</button><button className="secondary" onClick={reset}><RotateCcw size={16} /> Scan another label</button></div> : null}
  </section>;
}

function QrCodeIcon() { return <svg viewBox="0 0 24 24" width="29" height="29" aria-hidden="true"><path d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm9-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 14h7v7H3v-7Zm2 2v3h3v-3H5Zm9-2h3v3h-3v-3Zm4 0h3v7h-3v-3h-2v3h-2v-3h2v-2h2v-2Z" fill="currentColor" /></svg>; }
