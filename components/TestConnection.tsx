'use client'

import React from 'react'
import {
  useConnect,
  useAccount,
  useDisconnect,
  useNetwork,
} from 'wagmi'

export default function TestConnection() {
  const { connect, connectors, error: connectError, isLoading, pendingConnector } = useConnect()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { chain } = useNetwork()

  return (
    <div style={{ padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>Wagmi Connection Test</h2>

      {isConnected ? (
        <>
          <p><strong>🟢 Connected!</strong></p>
          <p>Address: {address}</p>
          <p>Chain: {chain?.name} (ID:{chain?.id})</p>
          <button onClick={() => disconnect()}>Disconnect</button>
        </>
      ) : (
        <>
          <p><strong>⚪ Not connected</strong></p>
          {connectors.map((c) => (
            <button
              key={c.id}
              onClick={() => connect({ connector: c })}
              disabled={!c.ready || isLoading}
              style={{ marginRight: 8 }}
            >
              {isLoading && pendingConnector?.id === c.id
                ? 'Connecting…'
                : `Connect ${c.name}`}
              {!c.ready && ' (unsupported)'}
            </button>
          ))}
          {connectError && <p style={{ color: 'red' }}>{connectError.message}</p>}
        </>
      )}
    </div>
  )
}
