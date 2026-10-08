import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/newsreader/opsz-italic.css'
import '@fontsource-variable/noto-serif-malayalam'
import '@fontsource-variable/noto-sans-malayalam'
import '@fontsource/manjari/400.css'
import '@fontsource/manjari/700.css'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App'
import * as store from './state/store'
import * as pipeline from './llm/pipeline'

// Dev only: lets the test harness inject fixtures and inspect state from the console.
if (import.meta.env.DEV) Object.assign(window, { __dss: { ...store, ...pipeline } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
