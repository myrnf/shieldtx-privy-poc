import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import { App } from './ui/App'
import { PRIVY_APP_ID } from './chain/config'
import { privyConfig } from './privy/privyConfig'
import './ui/styles.css'

const root = createRoot(document.getElementById('root')!)

if (!PRIVY_APP_ID) {
  root.render(<p style={{ padding: 24 }}>Set VITE_PRIVY_APP_ID in .env (see .env.example) and restart.</p>)
} else {
  root.render(
    <StrictMode>
      <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
        <App />
      </PrivyProvider>
    </StrictMode>,
  )
}
