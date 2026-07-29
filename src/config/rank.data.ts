export interface Rank {
  id: number;
  name: string;
  minScore: number;
  experienceToNextRank: number;
}

export const Ranks: Rank[] = [
  { id: 1, name: "Recruit", minScore: 0, experienceToNextRank: 100 },
  { id: 2, name: "Private", minScore: 100, experienceToNextRank: 400 },
  { id: 3, name: "Gefreiter", minScore: 500, experienceToNextRank: 1000 },
  { id: 4, name: "Corporal", minScore: 1500, experienceToNextRank: 2200 },
  { id: 5, name: "Master Corporal", minScore: 3700, experienceToNextRank: 3400 },
  { id: 6, name: "Sergeant", minScore: 7100, experienceToNextRank: 5200 },
  { id: 7, name: "Staff Sergeant", minScore: 12300, experienceToNextRank: 7700 },
  { id: 8, name: "Master Sergeant", minScore: 20000, experienceToNextRank: 9000 },
  { id: 9, name: "First Sergeant", minScore: 29000, experienceToNextRank: 12000 },
  { id: 10, name: "Sergeant-Major", minScore: 41000, experienceToNextRank: 16000 },
  { id: 11, name: "Warrant Officer 1", minScore: 57000, experienceToNextRank: 19000 },
  { id: 12, name: "Warrant Officer 2", minScore: 76000, experienceToNextRank: 22000 },
  { id: 13, name: "Warrant Officer 3", minScore: 98000, experienceToNextRank: 27000 },
  { id: 14, name: "Warrant Officer 4", minScore: 125000, experienceToNextRank: 31000 },
  { id: 15, name: "Warrant Officer 5", minScore: 156000, experienceToNextRank: 36000 },
  { id: 16, name: "Third Lieutenant", minScore: 192000, experienceToNextRank: 41000 },
  { id: 17, name: "Second Lieutenant", minScore: 233000, experienceToNextRank: 47000 },
  { id: 18, name: "First Lieutenant", minScore: 280000, experienceToNextRank: 52000 },
  { id: 19, name: "Captain", minScore: 332000, experienceToNextRank: 58000 },
  { id: 20, name: "Major", minScore: 390000, experienceToNextRank: 65000 },
  { id: 21, name: "Lieutenant Colonel", minScore: 455000, experienceToNextRank: 72000 },
  { id: 22, name: "Colonel", minScore: 527000, experienceToNextRank: 79000 },
  { id: 23, name: "Brigadier", minScore: 606000, experienceToNextRank: 86000 },
  { id: 24, name: "Major General", minScore: 692000, experienceToNextRank: 95000 },
  { id: 25, name: "Lieutenant General", minScore: 787000, experienceToNextRank: 102000 },
  { id: 26, name: "General", minScore: 889000, experienceToNextRank: 111000 },
  { id: 27, name: "Marshal", minScore: 1000000, experienceToNextRank: 122000 },
  { id: 28, name: "Field Marshal", minScore: 1122000, experienceToNextRank: 133000 },
  { id: 29, name: "Commander", minScore: 1255000, experienceToNextRank: 145000 },
  { id: 30, name: "Generalissimo", minScore: 1400000, experienceToNextRank: 0 },
];

// Hard accumulation ceiling = the client's score field max (signed i32). Experience is clamped here
// so a kill (or any XP gain) can't overflow the field on an already-huge account.
export const MAX_EXPERIENCE: number = 2147483647;
// Teto do /addscore — 100 milhões de XP (ainda abaixo do MAX_EXPERIENCE signed i32).
export const MAX_COMMAND_SCORE: number = 100_000_000;
