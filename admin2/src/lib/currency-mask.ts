import type React from "react";
// Utilitário para máscara monetária brasileira
export class CurrencyMask {
  // Formatar valor numérico para exibição (ex: 12345 -> "123,45")
  static formatForDisplay(value: number | string): string {
    const num = typeof value === 'string' ? parseFloat(value) || 0 : value || 0;
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  }

  // Aplicar máscara durante digitação (ex: "12345" -> "123,45")
  static applyMask(input: string): string {
    // Remove tudo que não é dígito
    const digits = input.replace(/\D/g, '');
    
    if (digits === '') return '';
    
    // Converte para centavos (últimos 2 dígitos são decimais)
    const cents = parseInt(digits, 10);
    const reais = cents / 100;
    
    return this.formatForDisplay(reais);
  }

  // Extrair valor numérico da string mascarada (ex: "123,45" -> 123.45)
  static parseValue(maskedValue: string): number {
    if (!maskedValue) return 0;
    
    // Remove separadores e converte vírgula para ponto
    const cleaned = maskedValue
      .replace(/\./g, '') // Remove pontos de milhar
      .replace(',', '.'); // Vírgula decimal vira ponto
    
    return parseFloat(cleaned) || 0;
  }

  // Handler para onChange de inputs
  static createHandler(setValue: (value: number) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const maskedValue = this.applyMask(e.target.value);
      const numericValue = this.parseValue(maskedValue);
      
      // Atualiza valor exibido
      e.target.value = maskedValue;
      
      // Atualiza estado
      setValue(numericValue);
    };
  }
}