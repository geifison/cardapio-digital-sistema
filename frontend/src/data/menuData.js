// Dados do cardápio
export const menuData = {
  pizzas: [
    {
      id: 1,
      name: "Pizza Margherita",
      description: "Molho de tomate, mozzarella fresca, manjericão e azeite extra virgem",
      price: 32.90,
      image: "/src/assets/kaB01W3uUueL.jpg",
      category: "pizza",
      popular: true,
      ingredients: ["Molho de tomate", "Mozzarella", "Manjericão", "Azeite"]
    },
    {
      id: 2,
      name: "Pizza Margherita Especial",
      description: "Nossa versão especial com tomates frescos e mozzarella de búfala",
      price: 38.90,
      image: "/src/assets/IwehTKZ5B4U6.jpg",
      category: "pizza",
      popular: false,
      ingredients: ["Molho de tomate", "Mozzarella de búfala", "Tomate fresco", "Manjericão"]
    },
    {
      id: 3,
      name: "Pizza Margherita Artesanal",
      description: "Pizza artesanal com massa fermentada por 48h e ingredientes selecionados",
      price: 42.90,
      image: "/src/assets/LxxTxrGoeTu6.jpg",
      category: "pizza",
      popular: true,
      ingredients: ["Massa artesanal", "Molho especial", "Mozzarella premium", "Manjericão fresco"]
    }
  ],
  hamburgers: [
    {
      id: 4,
      name: "Hambúrguer Artesanal",
      description: "Blend de carnes nobres, queijo cheddar, alface, tomate e molho especial",
      price: 28.90,
      image: "/src/assets/gDdkR1t6VZpo.jpg",
      category: "hamburger",
      popular: true,
      ingredients: ["Blend 180g", "Queijo cheddar", "Alface", "Tomate", "Molho especial"]
    },
    {
      id: 5,
      name: "Hambúrguer Gourmet",
      description: "Hambúrguer premium com bacon crocante e queijo gruyère",
      price: 34.90,
      image: "/src/assets/cfIFdqFcCa1c.webp",
      category: "hamburger",
      popular: false,
      ingredients: ["Blend premium 200g", "Bacon", "Queijo gruyère", "Rúcula", "Cebola caramelizada"]
    },
    {
      id: 6,
      name: "Hambúrguer Duplo",
      description: "Dois hambúrgueres suculentos com queijo e molho barbecue",
      price: 39.90,
      image: "/src/assets/uE0etRblRRvr.jpg",
      category: "hamburger",
      popular: true,
      ingredients: ["2x Blend 150g", "Queijo cheddar duplo", "Molho barbecue", "Picles", "Cebola"]
    }
  ],
  sides: [
    {
      id: 7,
      name: "Batata Frita Crocante",
      description: "Batatas cortadas na hora e fritas até ficarem douradas e crocantes",
      price: 12.90,
      image: "/src/assets/irrPn2pdIlNN.jpg",
      category: "side",
      popular: true,
      ingredients: ["Batata", "Sal marinho", "Óleo vegetal"]
    },
    {
      id: 8,
      name: "Batata Frita Premium",
      description: "Batatas especiais com temperos exclusivos e molho à parte",
      price: 16.90,
      image: "/src/assets/zsmsRkNZ2reX.jpg",
      category: "side",
      popular: false,
      ingredients: ["Batata premium", "Temperos especiais", "Molho ranch"]
    }
  ]
};

export const categories = [
  { id: 'all', name: 'Todos', icon: '🍽️' },
  { id: 'pizza', name: 'Pizzas', icon: '🍕' },
  { id: 'hamburger', name: 'Hambúrgueres', icon: '🍔' },
  { id: 'side', name: 'Acompanhamentos', icon: '🍟' }
];

export const getAllItems = () => {
  return [...menuData.pizzas, ...menuData.hamburgers, ...menuData.sides];
};

export const getItemsByCategory = (category) => {
  if (category === 'all') return getAllItems();
  return getAllItems().filter(item => item.category === category);
};

export const getPopularItems = () => {
  return getAllItems().filter(item => item.popular);
};

