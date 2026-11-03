import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('ESSENCE storefront render error:', error)
  }

  render() {
    if (this.state.failed) {
      return (
        <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:'32px',background:'#f7f6f2',color:'#242720',fontFamily:'Arial,sans-serif',textAlign:'center'}}>
          <div>
            <h1 style={{fontFamily:'Georgia,serif',fontWeight:400}}>ESSENCE</h1>
            <p>We’re having trouble loading the storefront. Please refresh the page.</p>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <AppErrorBoundary><App /></AppErrorBoundary>
    </React.StrictMode>
  )
}
