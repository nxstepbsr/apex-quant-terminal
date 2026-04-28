"use client";

import { useEffect, useRef, useState } from "react";

export type TradeMode = "LONG" | "SHORT" | "NEUTRAL";

export type ConfidenceScoreData = {
  symbol: string;
  score: number;
  gates: {
    contextualTrend: boolean;
    volatilityEntry: boolean;
    volumePriceConfirmation: boolean;
  };
  riskFlags: {
    spreadTooWide: boolean;
    newsBlackout: boolean;
    stopMovedToBreakeven: boolean;
    profitToSlippageRatioTooLow?: boolean;
    lowLiquidity?: boolean;
    reversalCandleDetected?: boolean;
  };
  updatedAt: string;
  tradeLevels: {
    mode: TradeMode;
    entry: number;
    stopLoss: number | null;
    takeProfit2R: number | null;
    takeProfit3R?: number | null;
    riskPerShare: number;
    breakEvenPoint?: number | null;
    estimatedRoundTripExecutionCost?: number;
  };
  debug?: {
    rvol?: number;
    tradeMode?: TradeMode;
  };
};

type LiveTradingState = {
  data: ConfidenceScoreData | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
};

export function useLiveTradingData(symbol: string) {
  const [state, setState] = useState<LiveTradingState>({
    data: null,
    isConnected: false,
    isLoading: false,
    error: null,
  });

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const manuallyClosedRef = useRef(false);

  useEffect(() => {
    if (!symbol.trim()) {
      setState({ data: null, isConnected: false, isLoading: false, error: null });
      return;
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const wsBase = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

    function connect() {
      manuallyClosedRef.current = false;
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const socket = new WebSocket(`${wsBase}/ws/trading/${cleanSymbol}`);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setState((prev) => ({ ...prev, isConnected: true, isLoading: false, error: null }));
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === "error") {
            setState((prev) => ({ ...prev, error: payload.message || "Backend stream error.", isLoading: false }));
            return;
          }

          setState({ data: payload, isConnected: true, isLoading: false, error: null });
        } catch {
          setState((prev) => ({ ...prev, error: "Failed to parse WebSocket payload.", isLoading: false }));
        }
      };

      socket.onerror = () => {
        setState((prev) => ({ ...prev, error: "WebSocket connection error.", isConnected: false, isLoading: false }));
      };

      socket.onclose = () => {
        setState((prev) => ({ ...prev, isConnected: false, isLoading: false }));
        if (manuallyClosedRef.current) return;

        const attempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = attempt;
        const delay = Math.min(1000 * 2 ** attempt, 15000);

        reconnectTimerRef.current = setTimeout(() => connect(), delay);
      };
    }

    connect();

    return () => {
      manuallyClosedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [symbol]);

  return state;
}
