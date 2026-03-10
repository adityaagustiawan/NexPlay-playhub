import game1 from "@/assets/game-1.jpg";
import game2 from "@/assets/game-2.jpg";
import game3 from "@/assets/game-3.jpg";
import game4 from "@/assets/game-4.jpg";
import game5 from "@/assets/game-5.jpg";
import game6 from "@/assets/game-6.jpg";

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

export const games: Game[] = [
  {
    id: "1",
    title: "STELLAR FORGE",
    description: "Build and defend your space station in this sci-fi strategy game. Mine asteroids, research tech, and fend off alien invaders.",
    image: game1,
    genre: "STRATEGY",
    rating: 4.8,
    players: "12.4K",
    owned: true,
    creator: "Nova Studios",
  },
  {
    id: "2",
    title: "GATE KEEPER",
    description: "An epic dark fantasy RPG. Explore vast kingdoms, slay mythical beasts, and uncover ancient secrets behind the castle gates.",
    image: game2,
    genre: "RPG",
    rating: 4.6,
    players: "8.7K",
    owned: true,
    creator: "Ironclad Games",
  },
  {
    id: "3",
    title: "NEON DRIFT",
    description: "High-speed synthwave racing. Drift through neon-lit circuits, upgrade your rides, and dominate the leaderboards.",
    image: game3,
    genre: "RACING",
    rating: 4.5,
    players: "15.2K",
    owned: false,
    price: 4.99,
    creator: "Retro Pixel Co",
  },
  {
    id: "4",
    title: "ORB ASCENT",
    description: "A meditative puzzle platformer. Navigate floating islands, collect glowing orbs, and solve gravity-defying puzzles.",
    image: game4,
    genre: "PUZZLE",
    rating: 4.9,
    players: "6.1K",
    owned: true,
    creator: "Zen Interactive",
  },
  {
    id: "5",
    title: "CYBER GRID",
    description: "Command a cyberpunk city. Build infrastructure, manage factions, and defend against corporate warfare in this city builder.",
    image: game5,
    genre: "SIMULATION",
    rating: 4.3,
    players: "9.8K",
    owned: false,
    price: 7.99,
    creator: "Neon Byte",
  },
  {
    id: "6",
    title: "DEAD SIGNAL",
    description: "Survival horror aboard an abandoned space station. Scavenge supplies, avoid creatures, and find a way to send a distress signal.",
    image: game6,
    genre: "HORROR",
    rating: 4.7,
    players: "11.3K",
    owned: false,
    price: 5.99,
    creator: "Shadow Works",
  },
];

export interface Friend {
  id: string;
  name: string;
  status: "online" | "offline" | "in-game";
  currentGame?: string;
  avatar: string;
}

export const friends: Friend[] = [
  { id: "1", name: "PIXEL_HUNTER", status: "online", avatar: "PH" },
  { id: "2", name: "NOVA_STRIKE", status: "in-game", currentGame: "STELLAR FORGE", avatar: "NS" },
  { id: "3", name: "DARK_MAGE_99", status: "online", avatar: "DM" },
  { id: "4", name: "RETRO_RACER", status: "offline", avatar: "RR" },
  { id: "5", name: "ZEN_MASTER", status: "in-game", currentGame: "ORB ASCENT", avatar: "ZM" },
  { id: "6", name: "CYBER_WOLF", status: "online", avatar: "CW" },
  { id: "7", name: "GHOST_RUNNER", status: "offline", avatar: "GR" },
  { id: "8", name: "BLAZE_FURY", status: "in-game", currentGame: "NEON DRIFT", avatar: "BF" },
];

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
