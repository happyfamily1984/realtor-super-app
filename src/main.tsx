import { createRoot } from 'react-dom/client'
import App from './App'
import '@fontsource/noto-serif-kr/korean-700.css'
import '@fontsource/noto-serif-kr/korean-900.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)
