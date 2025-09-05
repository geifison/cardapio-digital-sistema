import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator.jsx';
import { CheckoutModal } from './CheckoutModal.jsx';
import { useState } from 'react';
import { useCart } from '@/stores/cart.jsx';

export function CartSidebar() {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const { items, quantity, subtotal, total, setQuantity, removeItem } = useCart();
  const totalItems = quantity;
  const totalPrice = subtotal;

  const handleCheckout = () => {
    setIsCheckoutOpen(true);
  };

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button className="fixed bottom-4 right-4 rounded-full w-14 h-14 shadow-lg bg-green-600 hover:bg-green-700">
            <ShoppingCart className="w-6 h-6" />
            {totalItems > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-red-500 text-white min-w-[20px] h-5 flex items-center justify-center text-xs">
                {totalItems}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Seu Pedido</SheetTitle>
            <SheetDescription>
              {totalItems === 0 ? 'Seu carrinho está vazio' : `${totalItems} ${totalItems === 1 ? 'item' : 'itens'} no carrinho`}
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Adicione itens ao seu carrinho para continuar</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {items.map((item, index) => (
                    <div key={item.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          R$ {item.price.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setQuantity(index, item.qty - 1)}
                          className="w-8 h-8 p-0"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.qty}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setQuantity(index, item.qty + 1)}
                          className="w-8 h-8 p-0"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeItem(index)}
                          className="w-8 h-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Taxa de entrega:</span>
                    <span>R$ 5,00</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span>R$ {total.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
                
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handleCheckout}
                >
                  Finalizar Pedido
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
      />
    </>
  );
}

