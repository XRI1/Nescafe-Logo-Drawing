import { encoder, subscribeToDesigns } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const safeEnqueue = (payload) => {
        if (closed) return;
        try { controller.enqueue(payload); } catch { cleanup(); }
      };
      const unsubscribe = subscribeToDesigns(safeEnqueue);
      const heartbeat = setInterval(() => safeEnqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`)), 15_000);
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch {}
      };
      request.signal.addEventListener("abort", cleanup, { once: true });
      safeEnqueue(encoder.encode("retry: 2000\nevent: connected\ndata: {}\n\n"));
    },
    cancel() { cleanup(); }
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
