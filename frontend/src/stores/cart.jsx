import { createContext, useContext, useReducer, useEffect } from 'react'

// Initial state
const initialState = {
  items: [],
  client: {
    nome: '',
    telefone: '',
    tipoEntrega: 'delivery',
    endereco: '',
    numero: '',
    bairro: '',
    referencia: '',
    pagamento: 'dinheiro'
  },
  deliveryFee: 5.00,
  discount: 0
}

// Action types
const CART_ACTIONS = {
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  SET_QUANTITY: 'SET_QUANTITY',
  CLEAR_CART: 'CLEAR_CART',
  SET_CLIENT: 'SET_CLIENT',
  APPLY_COUPON: 'APPLY_COUPON',
  LOAD_CART: 'LOAD_CART'
}

// Reducer function
function cartReducer(state, action) {
  switch (action.type) {
    case CART_ACTIONS.ADD_ITEM: {
      const existingItemIndex = state.items.findIndex(item => 
        item.id === action.payload.id && 
        JSON.stringify(item.options) === JSON.stringify(action.payload.options)
      )

      if (existingItemIndex >= 0) {
        const newItems = [...state.items]
        newItems[existingItemIndex].qty += 1
        return { ...state, items: newItems }
      } else {
        return {
          ...state,
          items: [...state.items, { ...action.payload, qty: 1 }]
        }
      }
    }

    case CART_ACTIONS.REMOVE_ITEM: {
      const newItems = state.items.filter((_, index) => index !== action.payload)
      return { ...state, items: newItems }
    }

    case CART_ACTIONS.SET_QUANTITY: {
      const { index, qty } = action.payload
      if (qty <= 0) {
        const newItems = state.items.filter((_, i) => i !== index)
        return { ...state, items: newItems }
      } else {
        const newItems = [...state.items]
        newItems[index].qty = qty
        return { ...state, items: newItems }
      }
    }

    case CART_ACTIONS.CLEAR_CART:
      return { ...state, items: [], discount: 0 }

    case CART_ACTIONS.SET_CLIENT:
      return {
        ...state,
        client: { ...state.client, ...action.payload }
      }

    case CART_ACTIONS.APPLY_COUPON: {
      const coupon = action.payload.toUpperCase()
      const subtotal = state.items.reduce((total, item) => total + (item.price * item.qty), 0)
      
      if (coupon === 'FRETEZERO') {
        return { ...state, discount: state.deliveryFee }
      } else if (coupon === '10OFF') {
        return { ...state, discount: subtotal * 0.1 }
      } else {
        return { ...state, discount: 0 }
      }
    }

    case CART_ACTIONS.LOAD_CART:
      return { ...state, ...action.payload }

    default:
      return state
  }
}

// Create context
const CartContext = createContext()

// Cart provider component
export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState)

  // Computed values
  const quantity = state.items.reduce((total, item) => total + item.qty, 0)
  const subtotal = state.items.reduce((total, item) => total + (item.price * item.qty), 0)
  const total = subtotal + state.deliveryFee - state.discount

  // Actions
  const addItem = (product) => {
    dispatch({ type: CART_ACTIONS.ADD_ITEM, payload: product })
  }

  const removeItem = (index) => {
    dispatch({ type: CART_ACTIONS.REMOVE_ITEM, payload: index })
  }

  const setQuantity = (index, qty) => {
    dispatch({ type: CART_ACTIONS.SET_QUANTITY, payload: { index, qty } })
  }

  const clearCart = () => {
    dispatch({ type: CART_ACTIONS.CLEAR_CART })
  }

  const setClient = (clientData) => {
    dispatch({ type: CART_ACTIONS.SET_CLIENT, payload: clientData })
  }

  const applyCoupon = (couponCode) => {
    const coupon = couponCode.toUpperCase()
    dispatch({ type: CART_ACTIONS.APPLY_COUPON, payload: coupon })
    
    if (coupon === 'FRETEZERO') {
      return { success: true, message: 'Cupom aplicado! Frete grátis.' }
    } else if (coupon === '10OFF') {
      return { success: true, message: 'Cupom aplicado! 10% de desconto.' }
    } else {
      return { success: false, message: 'Cupom inválido.' }
    }
  }

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify({
      items: state.items,
      client: state.client,
      discount: state.discount
    }))
  }, [state.items, state.client, state.discount])

  // Load cart from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cart')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        dispatch({ 
          type: CART_ACTIONS.LOAD_CART, 
          payload: {
            items: data.items || [],
            client: { ...initialState.client, ...data.client },
            discount: data.discount || 0
          }
        })
      } catch (error) {
        console.error('Error loading cart from localStorage:', error)
      }
    }
  }, [])

  const value = {
    // State
    items: state.items,
    client: state.client,
    deliveryFee: state.deliveryFee,
    discount: state.discount,
    // Computed
    quantity,
    subtotal,
    total,
    // Actions
    addItem,
    removeItem,
    setQuantity,
    clearCart,
    setClient,
    applyCoupon
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

// Hook to use cart context
export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}