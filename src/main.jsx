import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { CartProvider } from './cart.jsx'
import { ImageProvider } from './imageStore.jsx'
import { MenuProvider } from './menuStore.jsx'
import { PromotionsProvider } from './promotionsStore.jsx'
import { TableProvider } from './tableSession.jsx'
import { SettingsProvider } from './settingsStore.jsx'
import { CustomerProvider } from './customerStore.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <CustomerProvider>
          <MenuProvider>
            <PromotionsProvider>
              <ImageProvider>
                <TableProvider>
                  <CartProvider>
                    <App />
                  </CartProvider>
                </TableProvider>
              </ImageProvider>
            </PromotionsProvider>
          </MenuProvider>
        </CustomerProvider>
      </SettingsProvider>
    </BrowserRouter>
  </React.StrictMode>
)
