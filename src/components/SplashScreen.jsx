import { useState, useEffect } from 'react'
import { WALLET_NAME } from '../utils/cashu.js'

export default function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer)
          setTimeout(onComplete, 300)
          return 100
        }
        return prev + 5
      })
    }, 50)

    return () => clearInterval(timer)
  }, [onComplete])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2d1810 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <img
        src="/icon-192.png"
        alt="Logo"
        style={{
          width: '120px',
          height: '120px',
          marginBottom: '1em',
          borderRadius: '30px',
          animation: 'pulse 2s ease-in-out infinite'
        }}
      />
      <h1 style={{
        fontSize: '2em',
        fontWeight: 'bold',
        background: 'linear-gradient(90deg, #FFD700, #FF8C00)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '0.5em'
      }}>
        {WALLET_NAME}
      </h1>
      <p style={{
        fontSize: '0.9em',
        opacity: 0.7,
        marginBottom: '2em'
      }}>
        Bitcoin Ecash Wallet
      </p>

      <div style={{
        width: '200px',
        height: '4px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #FFD700, #FF8C00)',
          transition: 'width 0.3s ease'
        }} />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
      `}</style>
    </div>
  )
}
