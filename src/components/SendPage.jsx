import { useState, useEffect } from 'react'
import { getEncodedToken } from '@cashu/cashu-ts'
import { generateQR, vibrate } from '../utils/cashu.js'

// Lightning Send Component
function SendViaLightning({
  wallet,
  mintUrl,
  currentMintBalance,
  getProofs,
  saveProofs,
  calculateAllBalances,
  addTransaction,
  resetSendPage,
  setError,
  setSuccess,
  setLoading,
  loading,
  lightningInvoice,
  setLightningInvoice,
  decodedInvoice,
  setDecodedInvoice
}) {
  const [sendingPayment, setSendingPayment] = useState(false)

  const handleDecodeInvoice = async () => {
    if (!lightningInvoice.trim()) {
      setError('Please paste a Lightning invoice')
      return
    }

    try {
      setLoading(true)
      setError('')

      const invoice = lightningInvoice.trim().toLowerCase()
      if (!invoice.startsWith('ln')) {
        throw new Error('Invalid Lightning invoice format')
      }

      const meltQuote = await wallet.createMeltQuote(lightningInvoice.trim())

      setDecodedInvoice({
        amount: meltQuote.amount,
        fee: meltQuote.fee_reserve,
        total: meltQuote.amount + meltQuote.fee_reserve,
        quote: meltQuote.quote
      })

      setSuccess('Invoice decoded! Review and confirm.')

    } catch (err) {
      setError(`Failed to decode invoice: ${err.message}`)
      setDecodedInvoice(null)
    } finally {
      setLoading(false)
    }
  }

  const handlePayInvoice = async () => {
    if (!wallet || !decodedInvoice) return

    try {
      setSendingPayment(true)
      setError('')

      const totalAmount = decodedInvoice.total

      if (currentMintBalance < totalAmount) {
        throw new Error(`Insufficient balance. Need ${totalAmount} sats (including ${decodedInvoice.fee} sats fee)`)
      }

      const proofs = getProofs(mintUrl)

      if (!proofs || proofs.length === 0) {
        throw new Error('No proofs available')
      }

      const sendResult = await wallet.send(totalAmount, proofs)
      let proofsToKeep = []
      let proofsToSend = []

      if (sendResult) {
        proofsToKeep = sendResult.keep || sendResult.returnChange || sendResult.change || []
        proofsToSend = sendResult.send || sendResult.sendProofs || []
      }

      if (!proofsToSend || proofsToSend.length === 0) {
        throw new Error('Failed to prepare proofs for payment')
      }

      let meltResponse
      try {
        meltResponse = await wallet.meltTokens(decodedInvoice.quote, proofsToSend)
      } catch (firstError) {
        meltResponse = await wallet.meltTokens(
          {
            quote: decodedInvoice.quote,
            amount: decodedInvoice.amount,
            fee_reserve: decodedInvoice.fee
          },
          proofsToSend
        )
      }

      if (meltResponse && meltResponse.isPaid === false) {
        throw new Error('Invoice payment failed at the mint')
      }

      const changeProofs = meltResponse?.change || []
      const allRemainingProofs = [...proofsToKeep, ...changeProofs]

      saveProofs(mintUrl, allRemainingProofs)
      calculateAllBalances()

      addTransaction('send', decodedInvoice.amount, 'Paid Lightning invoice', mintUrl)

      vibrate([100, 50, 100])

      setSuccess(`✅ Sent ${decodedInvoice.amount} sats via Lightning!`)

      setTimeout(() => {
        resetSendPage()
        setDecodedInvoice(null)
        setLightningInvoice('')
      }, 2000)

    } catch (err) {
      let errorMessage = 'Unknown error occurred'

      if (err?.message) {
        errorMessage = err.message
      } else if (err?.detail) {
        errorMessage = err.detail
      } else if (typeof err === 'string') {
        errorMessage = err
      } else if (err?.error) {
        errorMessage = typeof err.error === 'string' ? err.error : JSON.stringify(err.error)
      }

      setError(`Payment failed: ${errorMessage}`)
    } finally {
      setSendingPayment(false)
    }
  }

  useEffect(() => {
    if (lightningInvoice && !decodedInvoice) {
      handleDecodeInvoice()
    }
  }, [lightningInvoice])

  return (
    <div className="card">
      <h3>⚡ Send via Lightning</h3>

      {!decodedInvoice ? (
        <>
          <p style={{ marginBottom: '1em' }}>
            Paste a Lightning invoice to pay
          </p>
          <div className="token-box">
            <textarea
              placeholder="Paste Lightning invoice here (lnbc...)"
              value={lightningInvoice}
              onChange={(e) => setLightningInvoice(e.target.value)}
              rows={4}
              style={{ fontSize: '0.75em' }}
            />
          </div>
          <button
            className="primary-btn"
            onClick={handleDecodeInvoice}
            disabled={loading || !lightningInvoice.trim()}
          >
            {loading ? 'Decoding...' : 'Decode Invoice'}
          </button>
        </>
      ) : (
        <>
          <div style={{
            background: 'rgba(81, 207, 102, 0.1)',
            padding: '1em',
            borderRadius: '8px',
            marginBottom: '1em'
          }}>
            <div style={{ marginBottom: '0.5em' }}>
              <span style={{ opacity: 0.7 }}>Amount:</span>
              <span style={{ float: 'right', fontWeight: 'bold' }}>{decodedInvoice.amount} sats</span>
            </div>
            <div style={{ marginBottom: '0.5em' }}>
              <span style={{ opacity: 0.7 }}>Network Fee:</span>
              <span style={{ float: 'right' }}>{decodedInvoice.fee} sats</span>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5em', marginTop: '0.5em' }}>
              <span style={{ opacity: 0.7 }}>Total:</span>
              <span style={{ float: 'right', fontWeight: 'bold', color: '#FF8C00' }}>{decodedInvoice.total} sats</span>
            </div>
          </div>

          <button
            className="primary-btn"
            onClick={handlePayInvoice}
            disabled={sendingPayment || currentMintBalance < decodedInvoice.total}
            style={{ marginBottom: '0.5em' }}
          >
            {sendingPayment ? 'Sending...' : `Pay ${decodedInvoice.total} sats`}
          </button>

          <button
            className="secondary-btn"
            onClick={() => {
              setDecodedInvoice(null)
              setLightningInvoice('')
            }}
            disabled={sendingPayment}
          >
            Cancel
          </button>
        </>
      )}

      <button
        className="back-btn"
        style={{ marginTop: '1em', position: 'relative', left: 0, transform: 'none' }}
        onClick={resetSendPage}
        disabled={sendingPayment}
      >
        ← Change Method
      </button>
    </div>
  )
}

// Main Send Page Component
export default function SendPage({
  wallet,
  mintUrl,
  currentMintBalance,
  getProofs,
  saveProofs,
  calculateAllBalances,
  addTransaction,
  addPendingToken,
  error,
  success,
  setError,
  setSuccess,
  loading,
  setLoading,
  onClose,
  onScanRequest
}) {
  const [sendMethod, setSendMethod] = useState(null)
  const [sendAmount, setSendAmount] = useState('')
  const [generatedToken, setGeneratedToken] = useState('')
  const [generatedQR, setGeneratedQR] = useState('')
  const [lightningInvoice, setLightningInvoice] = useState('')
  const [decodedInvoice, setDecodedInvoice] = useState(null)

  const resetSendPage = () => {
    setGeneratedToken('')
    setGeneratedQR('')
    setSendAmount('')
    setSendMethod(null)
    setLightningInvoice('')
    setDecodedInvoice(null)
    setError('')
    setSuccess('')
  }

  const handleSendEcash = async () => {
    if (!wallet || !sendAmount) return

    try {
      setLoading(true)
      setError('')
      const amount = parseInt(sendAmount)
      const proofs = getProofs(mintUrl)
      const currentBalance = currentMintBalance

      if (proofs.length === 0) {
        throw new Error('No tokens available. Mint some first!')
      }

      if (currentBalance < amount) {
        throw new Error(`Insufficient balance. You have ${currentBalance} sats.`)
      }

      const result = await wallet.send(amount, proofs)

      if (!result) {
        throw new Error('wallet.send returned nothing')
      }

      const { keep, send, returnChange } = result

      const proofsToKeep = keep || returnChange || []
      const proofsToSend = send || []

      if (!proofsToSend || proofsToSend.length === 0) {
        throw new Error('Failed to create send proofs')
      }

      saveProofs(mintUrl, proofsToKeep)
      calculateAllBalances()

      const token = getEncodedToken({
        token: [{ mint: mintUrl, proofs: proofsToSend }]
      })

      const qr = await generateQR(token)
      setGeneratedToken(token)
      setGeneratedQR(qr)

      const txId = addTransaction('send', amount, 'Ecash token generated', mintUrl, 'pending')
      addPendingToken(token, amount, mintUrl, proofsToSend, txId)

      setSuccess('Token generated! Copy to send.')
      setSendAmount('')

    } catch (err) {
      setError(`Send failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setSuccess('✓ Token copied!')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError('Failed to copy')
    }
  }

  return (
    <div className="app">
      <header>
        <button className="back-btn" onClick={() => {
          resetSendPage()
          onClose()
        }}>← Back</button>
        <h1>📤 Send</h1>
      </header>

      <div className="card balance-card-small">
        <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#FF8C00' }}>{currentMintBalance} sats</div>
        <div style={{ fontSize: '0.85em', opacity: 0.6 }}>Available Balance</div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {!sendMethod ? (
        <div className="card">
          <h3>Choose Send Method</h3>
          <p style={{ marginBottom: '1em', opacity: 0.8 }}>How do you want to send?</p>

          <button
            className="primary-btn"
            style={{ marginBottom: '0.5em', background: '#4CAF50' }}
            onClick={() => onScanRequest('send')}
          >
            <span style={{ fontSize: '1.2em', marginRight: '0.5em' }}>⌘</span> Scan to Pay
          </button>

          <button className="primary-btn" style={{ marginBottom: '0.5em' }} onClick={() => setSendMethod('ecash')}>
            💰 Send Ecash Token
          </button>
          <button className="primary-btn" onClick={() => setSendMethod('lightning')}>
            ⚡ Send via Lightning
          </button>
        </div>
      ) : sendMethod === 'lightning' ? (
        <SendViaLightning
          wallet={wallet}
          mintUrl={mintUrl}
          currentMintBalance={currentMintBalance}
          getProofs={getProofs}
          saveProofs={saveProofs}
          calculateAllBalances={calculateAllBalances}
          addTransaction={addTransaction}
          resetSendPage={resetSendPage}
          setError={setError}
          setSuccess={setSuccess}
          setLoading={setLoading}
          loading={loading}
          lightningInvoice={lightningInvoice}
          setLightningInvoice={setLightningInvoice}
          decodedInvoice={decodedInvoice}
          setDecodedInvoice={setDecodedInvoice}
        />
      ) : (
        <div className="card">
          <h3>💰 Send Ecash</h3>
          <p style={{ marginBottom: '1em' }}>
            Generate a token to send
          </p>
          <input
            type="number"
            placeholder="Amount in sats"
            value={sendAmount}
            onChange={(e) => setSendAmount(e.target.value)}
          />
          <button className="primary-btn" onClick={handleSendEcash} disabled={loading || !sendAmount || currentMintBalance === 0}>
            {loading ? 'Generating...' : 'Generate Token'}
          </button>

          {generatedToken && (
            <div style={{ marginTop: '1em' }}>
              {generatedQR && (
                <div style={{ textAlign: 'center', marginBottom: '1em' }}>
                  <img src={generatedQR} alt="QR Code" style={{ maxWidth: '280px', width: '100%', borderRadius: '8px' }} />
                </div>
              )}
              <div className="token-box">
                <textarea
                  readOnly
                  value={generatedToken}
                  rows={4}
                  style={{ fontSize: '0.7em', marginBottom: '0.5em' }}
                />
              </div>
              <button className="copy-btn" onClick={() => copyToClipboard(generatedToken)}>
                📋 Copy Token
              </button>
              <p style={{ fontSize: '0.75em', opacity: 0.5, marginTop: '0.5em', textAlign: 'center' }}>
                💡 Token will auto-clear once recipient claims it
              </p>
            </div>
          )}

          <button className="back-btn" style={{ marginTop: '1em', position: 'relative', left: 0, transform: 'none' }} onClick={resetSendPage}>
            ← Change Method
          </button>
        </div>
      )}
    </div>
  )
}
