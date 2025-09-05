export const categories = [
  { id: 'burgers', label: 'Burgers' },
  { id: 'pizzas', label: 'Pizzas' },
  { id: 'bebidas', label: 'Bebidas' },
  { id: 'sobremesas', label: 'Sobremesas' },
]

export const items = [
  // Burgers
  {
    id: 'b1',
    category: 'burgers',
    title: 'Classic Burger',
    description: 'Pão brioche, 160g smash, queijo prato, alface, tomate e molho da casa.',
    price: 24.9,
    image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?q=80&w=1600&auto=format&fit=crop',
    sizes: null,
    options: [
      { id:'bacon', label:'+ Bacon', price: 4 },
      { id:'cheddar', label:'+ Cheddar', price: 3 },
      { id:'dobro', label:'Carne em Dobro', price: 9 },
    ]
  },
  {
    id: 'b2',
    category: 'burgers',
    title: 'BBQ Crispy',
    description: 'Carne 160g, cheddar, cebola crispy e molho barbecue.',
    price: 28.9,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1600&auto=format&fit=crop',
    sizes: null,
    options: [
      { id:'bacon', label:'+ Bacon', price: 4 },
      { id:'salada', label:'+ Salada', price: 2 },
    ]
  },
  // Pizzas
  {
    id: 'p1',
    category: 'pizzas',
    title: 'Mussarela',
    description: 'Massa fina, molho de tomate, mussarela e orégano.',
    price: 39.9,
    image: 'https://images.unsplash.com/photo-1541745537413-b8046dc6d66c?q=80&w=1600&auto=format&fit=crop',
    sizes: ['Pequena','Média','Grande'],
    options: [
      { id:'catupiry', label:'Borda Catupiry', price: 6 },
      { id:'cheddar', label:'Borda Cheddar', price: 6 }
    ]
  },
  {
    id: 'p2',
    category: 'pizzas',
    title: 'Calabresa',
    description: 'Calabresa, cebola, azeitona e mussarela.',
    price: 44.9,
    image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?q=80&w=1600&auto=format&fit=crop',
    sizes: ['Pequena','Média','Grande'],
    options: [
      { id:'extra-queijo', label:'Extra queijo', price: 5 },
      { id:'sem-cebola', label:'Sem cebola', price: 0 }
    ]
  },
  // Bebidas
  {
    id: 'd1',
    category: 'bebidas',
    title: 'Refrigerante Lata',
    description: '350ml - Vários sabores',
    price: 6.5,
    image: 'https://images.unsplash.com/photo-1541976590-713941681591?q=80&w=1600&auto=format&fit=crop',
    sizes: null,
    options: []
  },
  {
    id: 'd2',
    category: 'bebidas',
    title: 'Suco Natural',
    description: '300ml - Laranja ou Limão',
    price: 8.5,
    image: 'https://images.unsplash.com/photo-1570158268183-d296b2892211?q=80&w=1600&auto=format&fit=crop',
    sizes: null,
    options: []
  },
  // Sobremesas
  {
    id: 's1',
    category: 'sobremesas',
    title: 'Brownie',
    description: 'Brownie de chocolate com nozes.',
    price: 12.9,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476e?q=80&w=1600&auto=format&fit=crop',
    sizes: null,
    options: [
      { id:'sorvete', label:'+ Bola de Sorvete', price: 3.5 }
    ]
  },
]
