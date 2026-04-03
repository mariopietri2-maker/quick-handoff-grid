// Mock data for UI prototyping

export const mockOrderOffers = [
  {
    id: '1',
    storeName: 'Burger Palace',
    storeAddress: '123 Main St',
    deliveryAddress: '456 Oak Ave',
    estimatedPayout: 12.50,
    totalDistance: 3.2,
    estimatedTime: 18,
    itemCount: 3,
  },
  {
    id: '2',
    storeName: 'Taco Express',
    storeAddress: '789 Elm Dr',
    deliveryAddress: '101 Pine Ln',
    estimatedPayout: 8.75,
    totalDistance: 1.8,
    estimatedTime: 12,
    itemCount: 2,
  },
];

export const mockActiveDelivery = {
  id: '3',
  storeName: 'Sushi Heaven',
  storeAddress: '555 Broadway',
  deliveryAddress: '222 Maple Ct',
  customerName: 'Alex M.',
  status: 'picked_up' as const,
  items: [
    { name: 'California Roll', quantity: 2 },
    { name: 'Miso Soup', quantity: 1 },
    { name: 'Edamame', quantity: 1 },
  ],
  estimatedPayout: 15.25,
  pickupChecklist: ['All items verified', 'Drinks included', 'Utensils added'],
};

export const mockEarnings = {
  today: { total: 87.50, trips: 6, hours: 4.5 },
  week: { total: 432.25, trips: 31, hours: 22.3 },
  breakdown: [
    { day: 'Mon', base: 45, tips: 18, bonus: 5 },
    { day: 'Tue', base: 52, tips: 22, bonus: 0 },
    { day: 'Wed', base: 38, tips: 15, bonus: 10 },
    { day: 'Thu', base: 61, tips: 28, bonus: 0 },
    { day: 'Fri', base: 55, tips: 20, bonus: 8 },
    { day: 'Sat', base: 0, tips: 0, bonus: 0 },
    { day: 'Sun', base: 0, tips: 0, bonus: 0 },
  ],
};

export const mockStoreOrders = [
  {
    id: '101',
    customerName: 'Sarah J.',
    status: 'placed' as const,
    items: [
      { name: 'Margherita Pizza', quantity: 1, price: 14.99 },
      { name: 'Caesar Salad', quantity: 1, price: 8.99 },
      { name: 'Garlic Bread', quantity: 2, price: 4.99 },
    ],
    total: 33.96,
    placedAt: new Date(Date.now() - 120000).toISOString(),
    estimatedPrepTime: 20,
    driverName: null,
    driverEta: null,
  },
  {
    id: '102',
    customerName: 'Mike R.',
    status: 'preparing' as const,
    items: [
      { name: 'Pepperoni Pizza', quantity: 2, price: 16.99 },
      { name: 'Buffalo Wings', quantity: 1, price: 12.99 },
    ],
    total: 46.97,
    placedAt: new Date(Date.now() - 480000).toISOString(),
    estimatedPrepTime: 15,
    driverName: 'Carlos D.',
    driverEta: 8,
  },
  {
    id: '103',
    customerName: 'Emily K.',
    status: 'ready' as const,
    items: [
      { name: 'Veggie Wrap', quantity: 1, price: 10.99 },
    ],
    total: 10.99,
    placedAt: new Date(Date.now() - 900000).toISOString(),
    estimatedPrepTime: 0,
    driverName: 'Jamie L.',
    driverEta: 2,
  },
];

export const mockMenuItems = [
  { id: '1', name: 'Margherita Pizza', category: 'Pizza', price: 14.99, isAvailable: true, isSnoozed: false },
  { id: '2', name: 'Pepperoni Pizza', category: 'Pizza', price: 16.99, isAvailable: true, isSnoozed: false },
  { id: '3', name: 'Caesar Salad', category: 'Salads', price: 8.99, isAvailable: true, isSnoozed: false },
  { id: '4', name: 'Garlic Bread', category: 'Sides', price: 4.99, isAvailable: true, isSnoozed: true },
  { id: '5', name: 'Buffalo Wings', category: 'Sides', price: 12.99, isAvailable: false, isSnoozed: false },
  { id: '6', name: 'Veggie Wrap', category: 'Wraps', price: 10.99, isAvailable: true, isSnoozed: false },
  { id: '7', name: 'Chocolate Cake', category: 'Desserts', price: 7.99, isAvailable: true, isSnoozed: false },
];
