# TODOS — The Envoy Protocol for Ethereum V1.0

## Reliability

### SDK auto-reconnection with block replay
- **What:** EthBridgeSDK event listener must detect RPC disconnections, auto-reconnect, and replay missed blocks so no TaskCreated events are lost
- **Why:** RPC WebSocket connections drop regularly in production. Without reconnection + replay, the agent silently stops receiving tasks — the #1 reliability issue for event-listening services
- **Impact:** Critical for production use
- **Depends on:** EthBridgeSDK listener implementation
- **Added:** 2026-03-19
