export interface Game {
  id: string;
  title: string;
  description: string;
  image: string;
  genre: string;
  rating: number;
  players: string;
  owned: boolean;
  price?: number;
  creator: string;
}

// No games yet — community-created games will populate here
export const games: Game[] = [];

export interface Friend {
  id: string;
  name: string;
  status: "online" | "offline" | "in-game";
  currentGame?: string;
  avatar: string;
}

// No friends yet
export const friends: Friend[] = [];

export interface TopUpPackage {
  id: string;
  coins: number;
  bonus: number;
  price: number;
  popular?: boolean;
}

export const topUpPackages: TopUpPackage[] = [
  { id: "1", coins: 100, bonus: 0, price: 0.99 },
  { id: "2", coins: 500, bonus: 50, price: 4.99 },
  { id: "3", coins: 1000, bonus: 150, price: 9.99, popular: true },
  { id: "4", coins: 2500, bonus: 500, price: 19.99 },
  { id: "5", coins: 5000, bonus: 1500, price: 39.99 },
  { id: "6", coins: 10000, bonus: 4000, price: 74.99 },
];
