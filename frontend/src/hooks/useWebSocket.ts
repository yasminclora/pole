export interface WsMessage {
  type: string
  message: string
  [key: string]: any
}

export function useWebSocket(_onMessage?: (msg: WsMessage) => void) {
  // WebSocket gere par NotificationProvider
}
