import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export interface PerfStage {
  name: string;
  durationMs: number;
  timestamp: number;
}

export interface RequestMetrics {
  requestId: string;
  method: string;
  path: string;
  startTime: number;
  stages: PerfStage[];
  queryCount: number;
  totalQueryDurationMs: number;
}

export function generateRequestId(incomingId?: string | null): string {
  if (incomingId && typeof incomingId === "string" && /^[a-zA-Z0-9_\-\.]{8,64}$/.test(incomingId)) {
    return incomingId;
  }
  const randomHex = crypto.randomBytes(8).toString("hex");
  return `req_${randomHex}`;
}

export function isPerfLoggingEnabled(): boolean {
  if (process.env.ENABLE_PERF_LOGS === "true" || process.env.ENABLE_PERF_LOGS === "1") {
    return true;
  }
  if (process.env.ENABLE_PERF_LOGS === "false" || process.env.ENABLE_PERF_LOGS === "0") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

export function getSlowThresholdMs(): number {
  const configured = parseInt(process.env.PERF_SLOW_THRESHOLD_MS || "250", 10);
  return isNaN(configured) ? 250 : configured;
}

export class RequestTimer {
  public readonly requestId: string;
  public readonly method: string;
  public readonly path: string;
  private startTime: number;
  private openStages: Map<string, number> = new Map();
  private completedStages: PerfStage[] = [];
  private queryCount: number = 0;
  private totalQueryDurationMs: number = 0;

  constructor(req: NextRequest, customPath?: string) {
    const rawIncoming = req.headers.get("x-request-id");
    this.requestId = generateRequestId(rawIncoming);
    this.method = req.method;
    this.path = customPath || req.nextUrl.pathname;
    this.startTime = performance.now();
  }

  public startStage(stageName: string) {
    this.openStages.set(stageName, performance.now());
  }

  public endStage(stageName: string): number {
    const start = this.openStages.get(stageName);
    const now = performance.now();
    const durationMs = start ? Math.round((now - start) * 100) / 100 : 0;
    this.openStages.delete(stageName);

    this.completedStages.push({
      name: stageName,
      durationMs,
      timestamp: now,
    });

    if (isPerfLoggingEnabled()) {
      console.log(
        `[PERF] request=${this.requestId} stage=${stageName} duration_ms=${durationMs}`
      );
    }
    return durationMs;
  }

  public async measure<T>(stageName: string, fn: () => Promise<T>): Promise<T> {
    this.startStage(stageName);
    try {
      return await fn();
    } finally {
      this.endStage(stageName);
    }
  }

  public recordQuery(queryName: string, durationMs: number) {
    this.queryCount += 1;
    this.totalQueryDurationMs += durationMs;
    if (isPerfLoggingEnabled()) {
      console.log(
        `[PERF] request=${this.requestId} stage=database.${queryName} duration_ms=${Math.round(durationMs * 100) / 100}`
      );
    }
  }

  public finish(response: NextResponse): NextResponse {
    const totalMs = Math.round((performance.now() - this.startTime) * 100) / 100;
    const status = response.status;

    // Attach request ID header to response
    response.headers.set("X-Request-ID", this.requestId);

    if (isPerfLoggingEnabled() || totalMs >= getSlowThresholdMs()) {
      const slowMarker = totalMs >= getSlowThresholdMs() ? " [SLOW]" : "";
      console.log(
        `[PERF] request=${this.requestId} method=${this.method} path=${this.path} total_ms=${totalMs} status=${status} queries=${this.queryCount}${slowMarker}`
      );
    }

    return response;
  }

  public getMetrics(): RequestMetrics {
    return {
      requestId: this.requestId,
      method: this.method,
      path: this.path,
      startTime: this.startTime,
      stages: [...this.completedStages],
      queryCount: this.queryCount,
      totalQueryDurationMs: this.totalQueryDurationMs,
    };
  }
}

export function createRequestTimer(req: NextRequest, customPath?: string): RequestTimer {
  return new RequestTimer(req, customPath);
}
