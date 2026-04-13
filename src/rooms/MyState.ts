import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") name: string = "";
  @type("string") animal: string = "rabbit"; // ✅ NEW: synced player sprite
  @type("string") team: string = ""; // "", "red", "blue"

  @type("number") x: number = 100;
  @type("number") y: number = 100;
  @type("number") score: number = 0;

  @type("boolean") shieldActive: boolean = false;
  @type("boolean") speedActive: boolean = false;
  @type("boolean") doublePointsActive: boolean = false;
  @type("boolean") magnetActive: boolean = false;

  @type("boolean") magnetLocked: boolean = false;
  @type("number") magnetLockedUntil: number = 0;

  @type("boolean") invisibleActive: boolean = false;
  @type("boolean") frozenActive: boolean = false;

  @type("number") shieldUntil: number = 0;
  @type("number") speedUntil: number = 0;
  @type("number") doublePointsUntil: number = 0;
  @type("number") magnetUntil: number = 0;
  @type("number") invisibleUntil: number = 0;
  @type("number") frozenUntil: number = 0;

  @type("string") magnetTargetSessionId: string = "";

  @type("boolean") canScore: boolean = false;

  // Stats
  @type("number") correctAnswers: number = 0;
  @type("number") totalAnswers: number = 0;
  @type("number") currentStreak: number = 0;
  @type("number") longestStreak: number = 0;
  @type("number") stealsMade: number = 0;
  @type("number") powerUpsCollected: number = 0;
}

export class ScoreToken extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") value: number = 10;
  @type("string") ownerSessionId: string = "";
  @type("number") expiresAt: number = 0;
  @type("string") team: string = ""; 
}

export class PowerUp extends Schema {
  @type("string") id: string = "";
  @type("string") type: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

export class QuestionSettings extends Schema {
  @type("boolean") addition: boolean = true;
  @type("boolean") subtraction: boolean = true;
  @type("boolean") multiplication: boolean = true;
  @type("boolean") division: boolean = true;
  @type("boolean") fractions: boolean = false;
  @type("boolean") orderOfOperations: boolean = false;

  @type("string") difficulty: string = "easy";
}

export class MyState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: PowerUp }) powerUps = new MapSchema<PowerUp>();
  @type({ map: ScoreToken }) scoreTokens = new MapSchema<ScoreToken>();

  @type("string") phase: string = "lobby";
  @type("boolean") gameStarted: boolean = false;
  @type("string") hostSessionId: string = "";
  @type("number") durationSeconds: number = 60;
  @type("number") countdownSeconds: number = 3;
  @type("number") countdownStartTimestamp: number = 0;
  @type("number") startTimestamp: number = 0;
  @type("number") winnerScore: number = 0;
  @type("string") selectedMap: string = "garden";
  @type("string") gameMode: string = "ffa";

  @type("number") countdownDisplaySeconds: number = 0;
  @type("number") gameDisplaySeconds: number = 0;

  @type(QuestionSettings) questionSettings = new QuestionSettings();
}