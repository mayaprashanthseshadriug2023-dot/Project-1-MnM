import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import { createApp } from './setup'
import './index.css'

const { controller, fs } = createApp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App controller={controller} registerFile={file => fs.addFile(file)} />
  </StrictMode>,
)