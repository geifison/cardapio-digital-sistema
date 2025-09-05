import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { ShoppingCart, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function FloatingActionButton({ itemCount, onClick, className = "" }) {
  return (
    <motion.div
      className={`fixed bottom-4 right-4 z-50 ${className}`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Button 
        onClick={onClick}
        className="rounded-full w-14 h-14 shadow-lg bg-green-600 hover:bg-green-700 relative"
      >
        <ShoppingCart className="w-6 h-6" />
        
        <AnimatePresence>
          {itemCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-2 -right-2"
            >
              <Badge className="bg-red-500 text-white min-w-[20px] h-5 flex items-center justify-center text-xs">
                {itemCount > 99 ? '99+' : itemCount}
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>
      </Button>
      
      {/* Pulse animation when items are added */}
      <AnimatePresence>
        {itemCount > 0 && (
          <motion.div
            className="absolute inset-0 rounded-full bg-green-600 opacity-30"
            initial={{ scale: 1 }}
            animate={{ scale: 1.2, opacity: 0 }}
            exit={{ scale: 1, opacity: 0.3 }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

