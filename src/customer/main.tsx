import { createRoot } from 'react-dom/client'
import '../styles.css'
import '../customer.css'
import CustomerApp from './App'
import { registerSw } from '../lib/push'

registerSw()
createRoot(document.getElementById('root')!).render(<CustomerApp />)
