import React from 'react'
export default function Networks({ w, switchNet, toast }) {
  const active = w.chain === '0xaa36a7'
  return <section className="view">
    <h2>Network</h2>
    <div className="group">
      <h3>Sepolia Testnet</h3>
      <p className="mute">Haven is configured for USDC on Ethereum Sepolia only. Other networks and custom network additions are disabled to prevent sending assets on the wrong chain.</p>
      <div className="split"><span><b>USDC · Sepolia</b><br/><small className="mute">Chain ID 11155111</small></span><b>{active ? 'Active' : 'Not connected'}</b></div>
      {!active && <button className="pri" onClick={() => switchNet('0xaa36a7')}>Switch to Sepolia</button>}
      <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer">Sepolia Etherscan</a>
    </div>
  </section>
}
