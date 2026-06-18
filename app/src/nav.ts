export type Route =
  | { name: "search" }
  | { name: "depute"; uid: string }
  | { name: "scrutin"; uid: string };

export interface Nav {
  push: (name: "depute" | "scrutin", params: { uid: string }) => void;
  pop: () => void;
}
