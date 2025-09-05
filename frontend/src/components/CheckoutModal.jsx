import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { CreditCard, Smartphone, MapPin, Clock, CheckCircle } from 'lucide-react';
import { useCart } from '@/stores/cart.jsx'
import { validateCheckoutForm, generateWhatsAppMessage, openWhatsApp, currency } from '@/lib/checkout-utils.js';
import { createOrder } from '@/lib/api.ts';
import OrderConfirmationModal from './OrderConfirmationModal.jsx';

export function CheckoutModal({ isOpen, onClose }) {
  const cart = useCart();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [orderNumber, setOrderNumber] = useState(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [savedCustomerData, setSavedCustomerData] = useState(null);
  const [errors, setErrors] = useState({});
  
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    tipoEntrega: 'delivery',
    endereco: '',
    numero: '',
    bairro: '',
    referencia: '',
    pagamento: 'pix',
    cupom: '',
    observations: ''
  });
  
  // Carrega dados do cliente salvos
  useEffect(() => {
    if (cart.customer && Object.keys(cart.customer).length > 0) {
      setFormData(prev => ({
        ...prev,
        nome: cart.customer.nome || '',
        telefone: cart.customer.telefone || '',
        endereco: cart.customer.endereco || '',
        numero: cart.customer.numero || '',
        bairro: cart.customer.bairro || '',
        referencia: cart.customer.referencia || ''
      }));
    }
  }, [cart.customer]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpa erro do campo quando usuário digita
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const applyCoupon = () => {
    cart.applyCoupon(formData.cupom);
  };

  const validateCurrentStep = () => {
    if (step === 1) {
      const validationErrors = validateCheckoutForm(formData);
      setErrors(validationErrors);
      return Object.keys(validationErrors).length === 0;
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateCurrentStep() && step < 3) {
      setStep(step + 1);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const resetState = () => {
    setStep(1);
    setSubmitting(false);
    setOrderNumber(null);
    setErrorMsg('');
    setShowConfirmationModal(false);
    setOrderData(null);
    setSavedCustomerData(null);
    setErrors({});
    setFormData({
      nome: '',
      telefone: '',
      tipoEntrega: 'delivery',
      endereco: '',
      numero: '',
      bairro: '',
      referencia: '',
      pagamento: 'pix',
      cupom: '',
      observations: ''
    });
  };

  const handleConfirmationModalClose = () => {
    setShowConfirmationModal(false);
    resetState();
  };

  const handleSubmit = async () => {
    if (!cart.items || cart.items.length === 0) {
      setErrorMsg('Seu carrinho está vazio.');
      return;
    }

    if (!validateCurrentStep()) {
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      // Prepara dados do pedido para a API
      const orderData = {
        customer_name: formData.nome,
        customer_phone: formData.telefone,
        customer_address: formData.tipoEntrega === 'delivery' ? `${formData.endereco}, ${formData.numero}` : '',
        customer_neighborhood: formData.bairro || '',
        customer_reference: formData.referencia || '',
        order_type: formData.tipoEntrega,
        payment_method: formData.pagamento,
        payment_value: formData.pagamento === 'dinheiro' ? formData.valorPagamento : null,
        delivery_fee: formData.tipoEntrega === 'delivery' ? 5.00 : 0.00,
        notes: formData.observacoes || '',
        estimated_delivery_time: 30,
        items: cart.items.map(item => ({
          product_id: item.id || 1,
          product_name: item.title || item.name || 'Item',
          product_price: item.price || 0,
          quantity: item.qty || item.quantity || 1,
          notes: item.options || ''
        }))
      };

      // Salva pedido no banco de dados
      const response = await createOrder(orderData);
      
      if (response.success) {
         // Salva dados do cliente
         const customerData = {
           nome: formData.nome,
           telefone: formData.telefone,
           endereco: formData.endereco,
           numero: formData.numero,
           bairro: formData.bairro,
           referencia: formData.referencia
         };
         
         cart.setClient(customerData);
         setSavedCustomerData(customerData);

         // Salva dados do pedido
         setOrderData(response.data);
         setOrderNumber(response.data.order_number);
         
         // Fecha modal de checkout e abre modal de confirmação
         onClose();
         setShowConfirmationModal(true);
         
         // Limpa carrinho após finalizar
         cart.clearCart();
       } else {
         throw new Error(response.message || 'Erro ao criar pedido');
       }
    } catch (error) {
      console.error('Erro ao processar pedido:', error);
      setErrorMsg(error.message || 'Erro ao processar pedido. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome completo</Label>
        <Input
          id="nome"
          value={formData.nome}
          onChange={(e) => handleInputChange('nome', e.target.value)}
          placeholder="Seu nome completo"
        />
        {errors.nome && <p className="text-sm text-red-600">{errors.nome}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="telefone">Telefone (WhatsApp)</Label>
        <Input
          id="telefone"
          value={formData.telefone}
          onChange={(e) => handleInputChange('telefone', e.target.value)}
          placeholder="(99) 99999-9999"
        />
        {errors.telefone && <p className="text-sm text-red-600">{errors.telefone}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="tipoEntrega">Tipo de entrega</Label>
        <RadioGroup
          value={formData.tipoEntrega}
          onValueChange={(value) => handleInputChange('tipoEntrega', value)}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="delivery" id="delivery" />
            <Label htmlFor="delivery">Entrega</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="retirada" id="retirada" />
            <Label htmlFor="retirada">Retirada</Label>
          </div>
        </RadioGroup>
      </div>
      
      {formData.tipoEntrega === 'delivery' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={formData.endereco}
              onChange={(e) => handleInputChange('endereco', e.target.value)}
              placeholder="Rua/Avenida, complemento"
            />
            {errors.endereco && <p className="text-sm text-red-600">{errors.endereco}</p>}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero">Número</Label>
              <Input
                id="numero"
                value={formData.numero}
                onChange={(e) => handleInputChange('numero', e.target.value)}
                placeholder="123"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input
                id="bairro"
                value={formData.bairro}
                onChange={(e) => handleInputChange('bairro', e.target.value)}
                placeholder="Nome do bairro"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="referencia">Ponto de referência (opcional)</Label>
            <Input
              id="referencia"
              value={formData.referencia}
              onChange={(e) => handleInputChange('referencia', e.target.value)}
              placeholder="Próximo ao..."
            />
          </div>
        </>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="cupom">Cupom de desconto</Label>
        <div className="flex gap-2">
          <Input
            id="cupom"
            value={formData.cupom}
            onChange={(e) => handleInputChange('cupom', e.target.value)}
            placeholder="FRETEZERO ou 10OFF"
          />
          <Button
            type="button"
            variant="outline"
            onClick={applyCoupon}
          >
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label>Método de pagamento</Label>
        <RadioGroup
          value={formData.pagamento}
          onValueChange={(value) => handleInputChange('pagamento', value)}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="pix" id="pix" />
            <Label htmlFor="pix" className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              PIX
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="credito" id="credito" />
            <Label htmlFor="credito" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Cartão de crédito
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="debito" id="debito" />
            <Label htmlFor="debito" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Cartão de débito
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dinheiro" id="dinheiro" />
            <Label htmlFor="dinheiro" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Dinheiro na entrega
            </Label>
          </div>
        </RadioGroup>
      </div>



      <div className="space-y-2">
        <Label htmlFor="observations">Observações (opcional)</Label>
        <Textarea
          id="observations"
          value={formData.observations}
          onChange={(e) => handleInputChange('observations', e.target.value)}
          placeholder="Alguma observação sobre o pedido?"
          rows={3}
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="bg-muted p-4 rounded-lg space-y-3">
        <h4 className="font-semibold">Resumo do Pedido</h4>
        {cart.items.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>
                <strong>{item.title || item.name || 'Item'}</strong>
                {item.size && <span className="text-muted-foreground"> ({item.size})</span>}
              </span>
              <span>{item.qty} x {currency(item.price)}</span>
            </div>
            {item.options && item.options.length > 0 && (
              <div className="text-xs text-muted-foreground ml-2">
                Opções: {item.options.join(', ')}
              </div>
            )}
          </div>
        ))}
        <Separator />
        <div className="flex justify-between text-sm">
          <span>Subtotal:</span>
          <span>{currency(cart.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Taxa de entrega:</span>
          <span>{currency(cart.deliveryFee)}</span>
        </div>
        {cart.discount > 0 && (
          <div className="flex justify-between text-sm">
            <span>Desconto:</span>
            <span>-{currency(cart.discount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <span>Total:</span>
          <span>{currency(cart.total)}</span>
        </div>
      </div>

      <div className="bg-muted p-4 rounded-lg space-y-3">
        <h4 className="font-semibold">Detalhes da Entrega</h4>
        <div className="text-sm">
          <p><strong>Nome:</strong> {formData.nome}</p>
          <p><strong>Telefone:</strong> {formData.telefone}</p>
          <p><strong>Tipo:</strong> {formData.tipoEntrega === 'delivery' ? 'Delivery' : 'Retirada'}</p>
          {formData.tipoEntrega === 'delivery' && (
            <p><strong>Endereço:</strong> {formData.endereco}, {formData.numero} - {formData.bairro}</p>
          )}
          {formData.referencia && (
            <p><strong>Referência:</strong> {formData.referencia}</p>
          )}
        </div>
      </div>

      <div className="bg-muted p-4 rounded-lg space-y-2">
        <h4 className="font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Tempo estimado
        </h4>
        <p className="text-sm">30-45 minutos</p>
      </div>

      <div className="bg-muted p-4 rounded-lg space-y-3">
        <h4 className="font-semibold">Método de Pagamento</h4>
        <div className="text-sm">
          <p><strong>Forma de pagamento:</strong> {formData.pagamento === 'pix' ? 'PIX' : formData.pagamento === 'credito' ? 'Cartão de Crédito' : formData.pagamento === 'debito' ? 'Cartão de Débito' : 'Dinheiro'}</p>
          {formData.observations && (
            <p><strong>Observações:</strong> {formData.observations}</p>
          )}
        </div>
      </div>

      {errorMsg && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}
    </div>
  );



  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open)=>{ if(!open){ onClose(); resetState(); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
             <DialogTitle>Finalizar Pedido</DialogTitle>
             <DialogDescription>
               Passo {step} de 3
             </DialogDescription>
           </DialogHeader>

          <div className="py-4">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </div>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={step === 1 ? onClose : handlePrevStep}
              disabled={submitting}
            >
              {step === 1 ? 'Cancelar' : 'Voltar'}
            </Button>
            <Button
              onClick={step === 3 ? handleSubmit : handleNextStep}
              className="bg-green-600 hover:bg-green-700"
              disabled={submitting}
            >
              {step === 3 ? (submitting ? 'Enviando...' : 'Confirmar Pedido') : 'Continuar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <OrderConfirmationModal
         isOpen={showConfirmationModal}
         onClose={handleConfirmationModalClose}
         orderData={orderData}
         customerData={savedCustomerData}
         cartItems={cart.items}
       />
    </>
  );
}

