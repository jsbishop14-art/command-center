// Board constants, free of any server/database import so client components can use them.
export const BOARDS = ["josh", "christine", "bishops"] as const;
export type Board = (typeof BOARDS)[number];

export function isBoard(value: string): value is Board {
  return (BOARDS as readonly string[]).includes(value);
}
