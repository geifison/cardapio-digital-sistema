// Utilitários para checkout - replicando lógica do sistema antigo

/**
 * Formata valor para moeda brasileira
 * @param {number} value - Valor a ser formatado
 * @returns {string} Valor formatado em BRL
 */
export const currency = (value) => {
  // Verifica se o valor é válido
  if (value === null || value === undefined || isNaN(value)) {
    return 'R$ 0,00'
  }
  
  // Converte para número se for string
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  
  return numValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

/**
 * Valida formulário de checkout
 * @param {object} form - Dados do formulário
 * @returns {object} Objeto com erros encontrados
 */
export const validateCheckoutForm = (form) => {
  const errors = {}
  
  // Validação do nome
  if (!form.nome || form.nome.trim() === '') {
    errors.nome = 'Informe seu nome'
  }
  
  // Validação do telefone (mesma regex do checkout antigo)
  const phoneRegex = /^(?:(?:\+|00)55)?\s?(?:\(?\d{2}\)?\s?)?(?:9?\d{4})-?\d{4}$/
  if (!phoneRegex.test(form.telefone)) {
    errors.telefone = 'Telefone inválido'
  }
  
  // Validação do endereço (apenas para delivery)
  if (form.tipoEntrega === 'delivery' && (!form.endereco || form.endereco.trim() === '')) {
    errors.endereco = 'Endereço é obrigatório'
  }
  
  return errors
}

/**
 * Gera mensagem formatada para WhatsApp
 * @param {object} cart - Store do carrinho
 * @param {object} form - Dados do formulário
 * @returns {string} Mensagem codificada para WhatsApp
 */
export const generateWhatsAppMessage = (cart, form) => {
  const lines = []
  
  lines.push('*Novo Pedido*')
  lines.push('')
  
  // Itens do carrinho
  cart.items.forEach((item, idx) => {
    const itemName = item.title || item.name || 'Item'
    const sizeText = item.size ? ` (${item.size})` : ''
    lines.push(`${idx + 1}. ${itemName}${sizeText} x${item.qty} — ${currency(item.price)}`)
    
    if (item.options && item.options.length > 0) {
      lines.push(`   • Opções: ${item.options.join(', ')}`)
    }
  })
  
  lines.push('')
  
  // Resumo financeiro
  lines.push(`Subtotal: ${currency(cart.subtotal)}`)
  lines.push(`Entrega: ${currency(cart.deliveryFee)}`)
  
  if (cart.discount > 0) {
    lines.push(`Desconto: -${currency(cart.discount)}`)
  }
  
  lines.push(`*Total: ${currency(cart.total)}*`)
  lines.push('')
  
  // Dados do cliente
  lines.push('*Cliente*')
  lines.push(`${form.nome} • ${form.telefone}`)
  
  if (form.tipoEntrega === 'delivery') {
    lines.push(`Entrega em: ${form.endereco}, ${form.numero} - ${form.bairro}`)
    if (form.referencia) {
      lines.push(`Ref.: ${form.referencia}`)
    }
  } else {
    lines.push('Retirada no balcão')
  }
  
  lines.push('')
  if (form.pagamento) {
    lines.push(`Pagamento: ${form.pagamento.toUpperCase()}`)
  }
  
  return encodeURIComponent(lines.join('\n'))
}

/**
 * Abre WhatsApp com mensagem formatada
 * @param {string} message - Mensagem codificada
 * @param {string} phoneNumber - Número do WhatsApp da loja
 */
export const openWhatsApp = (message, phoneNumber = '5599999999999') => {
  const url = `https://wa.me/${phoneNumber}?text=${message}`
  window.open(url, '_blank')
}