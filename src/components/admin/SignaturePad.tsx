"use client";

import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type SignaturePadProps = {
  title: string;
  existingUrl?: string;
  disabled?: boolean;
  onSave: (blob: Blob) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export default function SignaturePad({
  title,
  existingUrl,
  disabled = false,
  onSave,
  onDelete,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);

  function configureContext() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.2;
    context.strokeStyle = "#111827";

    return context;
  }

  function prepareCanvas(preserveDrawing = true) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const previousImage =
      preserveDrawing && hasDrawingRef.current
        ? canvas.toDataURL("image/png")
        : "";

    const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);

    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, rect.width, rect.height);

    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.2;
    context.strokeStyle = "#111827";

    if (previousImage) {
      const image = new Image();

      image.onload = () => {
        context.drawImage(image, 0, 0, rect.width, rect.height);
      };

      image.src = previousImage;
    } else {
      hasDrawingRef.current = false;
    }
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      prepareCanvas(false);
    });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    function handleResize() {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }

      resizeTimer = setTimeout(() => {
        prepareCanvas(true);
      }, 150);
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      cancelAnimationFrame(frame);

      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }

      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  function coordinates(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();

    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    };
  }

  function startDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled || saving) {
      return;
    }

    event.preventDefault();

    const canvas = canvasRef.current;
    const context = configureContext();

    if (!canvas || !context) {
      return;
    }

    canvas.setPointerCapture(event.pointerId);

    const point = coordinates(event);

    context.beginPath();
    context.moveTo(point.x, point.y);

    lastPointRef.current = point;
    drawingRef.current = true;
  }

  function draw(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled || saving) {
      return;
    }

    event.preventDefault();

    const context = configureContext();

    if (!context) {
      return;
    }

    const point = coordinates(event);
    const lastPoint = lastPointRef.current;

    if (lastPoint) {
      const middleX = (lastPoint.x + point.x) / 2;
      const middleY = (lastPoint.y + point.y) / 2;

      context.quadraticCurveTo(lastPoint.x, lastPoint.y, middleX, middleY);
      context.stroke();
    } else {
      context.lineTo(point.x, point.y);
      context.stroke();
    }

    lastPointRef.current = point;
    hasDrawingRef.current = true;
  }

  function stopDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault();

    const canvas = canvasRef.current;

    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function clearSignature() {
    if (disabled || saving) {
      return;
    }

    prepareCanvas(false);
  }

  async function saveSignature() {
    const canvas = canvasRef.current;

    if (!canvas || !hasDrawingRef.current) {
      alert("Faz primeiro a assinatura dentro da área indicada.");
      return;
    }

    setSaving(true);

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) {
            resolve(result);
            return;
          }

          reject(new Error("Não foi possível criar a imagem da assinatura."));
        }, "image/png");
      });

      await onSave(blob);
      prepareCanvas(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível guardar a assinatura: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSignature() {
    if (!onDelete || disabled || saving) {
      return;
    }

    const confirmed = window.confirm("Pretendes eliminar esta assinatura?");

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      await onDelete();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível eliminar a assinatura: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="signature-pad">
      <div className="signature-pad-header">
        <div>
          <strong>{title}</strong>
          <small>Assinar com o dedo, caneta, rato ou trackpad</small>
        </div>

        {existingUrl && (
          <span className="signature-saved-badge">Assinatura guardada</span>
        )}
      </div>

      {existingUrl && (
        <div className="signature-existing">
          <a href={existingUrl} target="_blank" rel="noreferrer">
            <img src={existingUrl} alt={title} />
          </a>

          {onDelete && (
            <button
              type="button"
              className="signature-delete-button"
              disabled={disabled || saving}
              onClick={() => void deleteSignature()}
            >
              Eliminar assinatura
            </button>
          )}
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="signature-canvas"
        aria-label={title}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={(event) => {
          if (drawingRef.current) {
            stopDrawing(event);
          }
        }}
      />

      <div className="signature-pad-actions">
        <button
          type="button"
          className="signature-clear-button"
          disabled={disabled || saving}
          onClick={clearSignature}
        >
          Limpar
        </button>

        <button
          type="button"
          className="signature-save-button"
          disabled={disabled || saving}
          onClick={() => void saveSignature()}
        >
          {saving ? "A guardar..." : "Guardar assinatura"}
        </button>
      </div>
    </section>
  );
}
