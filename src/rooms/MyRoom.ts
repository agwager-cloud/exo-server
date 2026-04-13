import { Room, Client } from "colyseus";
import { MyState, Player, PowerUp, ScoreToken } from "./MyState.js";

export class MyRoom extends Room {
  maxClients = 40;
  state = new MyState();
  roomCode = "";

  readonly playerSize = 40;
  stealInterval: any = null;

readonly POWER_UP_TYPES = ["speed", "shield", "double", "magnet", "invisible", "freeze"];  readonly POWER_UP_SPAWN_INTERVAL = 8000;
  readonly MAX_POWER_UPS = 3;
  readonly POWER_UP_RADIUS = 30;

  //readonly MAGNET_RANGE = 2000;

  readonly SCORE_TOKEN_VALUE = 10;
  readonly SCORE_TOKEN_RADIUS = 55;
  
  readonly MAX_SCORE_TOKENS = 200;

  powerUpSpawnElapsed = 0;

  generateRoomCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }



  spawnScoreTokenForPlayer(ownerSessionId: string, player: Player) {
  if (this.state.scoreTokens.size >= this.MAX_SCORE_TOKENS) return;

  // ✅ Prevent duplicate tokens for the same player
  if (this.playerHasActiveScoreToken(ownerSessionId)) return;

  const id = `score_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const spawn = this.getScoreTokenSpawnPositionNearPlayer(player);

  const token = new ScoreToken();
  token.id = id;
  token.x = spawn.x;
  token.y = spawn.y;
  token.value = this.SCORE_TOKEN_VALUE;
  token.ownerSessionId = ownerSessionId;
  token.expiresAt = 0;
  token.team = player.team || "none";

  this.state.scoreTokens.set(id, token);
}

playerHasActiveScoreToken(ownerSessionId: string): boolean {
  let hasToken = false;

  this.state.scoreTokens.forEach((token: ScoreToken) => {
    if (token.ownerSessionId === ownerSessionId) {
      hasToken = true;
    }
  });

  return hasToken;
}


getScoreTokenSpawnPositionNearPlayer(player: Player) {
  const minDistance = 80;
  const maxDistance = 200;
  const angle = Math.random() * Math.PI * 2;
  const distance = minDistance + Math.random() * (maxDistance - minDistance);

  const x = player.x + Math.cos(angle) * distance;
  const y = player.y + Math.sin(angle) * distance;

  const margin = this.playerSize / 2 + 10;

  return {
    x: Math.max(margin, Math.min(this.worldWidth - margin, Math.round(x))),
    y: Math.max(margin, Math.min(this.worldHeight - margin, Math.round(y))),
  };
}

getRandomWorldSpawn(margin = 140) {
  return {
    x: margin + Math.floor(Math.random() * (this.worldWidth - margin * 2)),
    y: margin + Math.floor(Math.random() * (this.worldHeight - margin * 2)),
  };
}

checkScoreTokenPickups() {
  const toRemove: string[] = [];

  this.state.scoreTokens.forEach((token: ScoreToken, tokenId: string) => {
    
    const owner = this.state.players.get(token.ownerSessionId);
    if (!owner) {
      toRemove.push(tokenId);
      return;
    }

    const dx = owner.x - token.x;
    const dy = owner.y - token.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= this.SCORE_TOKEN_RADIUS) {
      const amount = owner.doublePointsActive ? token.value * 2 : token.value;
      owner.score += amount;
      toRemove.push(tokenId);
    }
  });

  for (const id of toRemove) {
    this.state.scoreTokens.delete(id);
  }
}

  onCreate(options: any) {

      this.roomCode = this.generateRoomCode();
      this.setMetadata({ roomCode: this.roomCode });

    this.onMessage("set_duration", (client, message: { durationSeconds?: number }) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== "lobby" && this.state.phase !== "finished") return;

      const duration =
        typeof message?.durationSeconds === "number"
          ? Math.max(10, Math.min(600, message.durationSeconds))
          : this.state.durationSeconds;

      this.state.durationSeconds = duration;
    });

    this.onMessage("set_map", (client, message: { map?: string }) => {
  if (client.sessionId !== this.state.hostSessionId) return;
  if (this.state.phase !== "lobby" && this.state.phase !== "finished") return;

  const validMaps = ["garden", "desert", "mars", "space"];

  if (typeof message?.map === "string" && validMaps.includes(message.map)) {
    this.state.selectedMap = message.map;
  }
});


    this.onMessage("set_game_mode", (client, message: { mode?: string }) => {
  if (client.sessionId !== this.state.hostSessionId) return;
  if (this.state.phase !== "lobby" && this.state.phase !== "finished") return;

  if (message.mode === "ffa" || message.mode === "teams") {
    this.state.gameMode = message.mode;
    this.assignTeams();
  }
});


    this.onMessage("set_question_settings", (client, message: any) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== "lobby" && this.state.phase !== "finished") return;

      if (typeof message?.addition === "boolean") {
        this.state.questionSettings.addition = message.addition;
      }
      if (typeof message?.subtraction === "boolean") {
        this.state.questionSettings.subtraction = message.subtraction;
      }
      if (typeof message?.multiplication === "boolean") {
        this.state.questionSettings.multiplication = message.multiplication;
      }
      if (typeof message?.division === "boolean") {
        this.state.questionSettings.division = message.division;
      }
      if (typeof message?.fractions === "boolean") {
        this.state.questionSettings.fractions = message.fractions;
      }
      if (typeof message?.orderOfOperations === "boolean") {
        this.state.questionSettings.orderOfOperations = message.orderOfOperations;
      }

      if (
        typeof message?.difficulty === "string" &&
        ["easy", "medium", "hard"].includes(message.difficulty)
      ) {
        this.state.questionSettings.difficulty = message.difficulty;
      }
    });

    this.onMessage("answer_result", (client, message: { correct?: boolean }) => {
  const player = this.state.players.get(client.sessionId);
  if (!player) return;
  if (this.state.phase !== "in_game") return;

  // Ignore any extra correct submits while their token is still active
  if (message.correct && this.playerHasActiveScoreToken(client.sessionId)) {
    return;
  }

  player.totalAnswers += 1;

  if (message.correct) {
    player.correctAnswers += 1;
    player.currentStreak += 1;

    if (player.currentStreak > player.longestStreak) {
      player.longestStreak = player.currentStreak;
    }

    this.spawnScoreTokenForPlayer(client.sessionId, player);
  } else {
    player.currentStreak = 0;
  }
});


    this.onMessage("return_to_lobby", (client) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      this.returnToLobby();
    });

        this.onMessage("swap_player_team", (client, message: { targetSessionId?: string }) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== "lobby" && this.state.phase !== "finished") return;
      if (typeof message?.targetSessionId !== "string") return;

      const target = this.state.players.get(message.targetSessionId);
      if (!target) return;

      if (target.team === "red") {
        target.team = "blue";
      } else if (target.team === "blue") {
        target.team = "red";
      } else {
        const redCount = this.getTeamPlayerCount("red");
        const blueCount = this.getTeamPlayerCount("blue");
        target.team = redCount <= blueCount ? "red" : "blue";
      }
    });

    this.onMessage("kick_player", (client, message: { targetSessionId?: string }) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== "lobby" && this.state.phase !== "finished") return;
      if (typeof message?.targetSessionId !== "string") return;
      if (message.targetSessionId === this.state.hostSessionId) return;

      const targetClient = this.clients.find((c) => c.sessionId === message.targetSessionId);
      if (!targetClient) return;

      targetClient.leave(4000);
    });

    this.onMessage("auto_balance_teams", (client) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== "lobby" && this.state.phase !== "finished") return;

      this.assignTeams();
    });

    this.onMessage("move", (client, message: { x: number; y: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const canMove =
        this.state.phase === "lobby" ||
     //   this.state.phase === "countdown" ||
        this.state.phase === "in_game";

      if (!canMove) return;

      if (
        this.state.phase === "in_game" &&
        (player.frozenActive || player.magnetLocked)
      ) {
        return;
      }

      player.x = message.x;
      player.y = message.y;
      this.keepPlayerInBounds(player);
    });

    this.onMessage("score", () => {
  // scoring is now server-authoritative via scoreTokens
});


    this.onMessage("start_game", (client, message: { durationSeconds?: number }) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== "lobby" && this.state.phase !== "finished") return;

      const duration =
        typeof message?.durationSeconds === "number"
          ? Math.max(10, Math.min(600, message.durationSeconds))
          : 60;

      this.startLobbyCountdown(duration);
    });

    this.setSimulationInterval((deltaTime) => {
  if (this.state.phase === "countdown") {
    const elapsed = (Date.now() - this.state.countdownStartTimestamp) / 1000;
    this.state.countdownDisplaySeconds = Math.max(
      1,
      Math.ceil(this.state.countdownSeconds - elapsed)
    );
    return;
  }

  if (this.state.phase === "in_game") {
    const elapsed = (Date.now() - this.state.startTimestamp) / 1000;
    this.state.gameDisplaySeconds = Math.max(
      0,
      Math.ceil(this.state.durationSeconds - elapsed)
    );

    this.powerUpSpawnElapsed += deltaTime;
    if (this.powerUpSpawnElapsed >= this.POWER_UP_SPAWN_INTERVAL) {
      this.powerUpSpawnElapsed = 0;
      this.spawnPowerUp();
    }

    this.checkScoreTokenPickups();
    this.checkPowerUpPickups();
    this.updatePowerUpEffects();
    this.applyMagnetEffects(deltaTime);
    return;
  }

  if (this.state.phase === "lobby" || this.state.phase === "finished") {
    this.state.countdownDisplaySeconds = 0;
    this.state.gameDisplaySeconds = 0;
  }
});
  }

  async onAuth(client: Client, options: any) {
  const requestedCode =
    typeof options?.roomCode === "string"
      ? options.roomCode.trim()
      : "";

  const creatingHost = !requestedCode;

  if (creatingHost) {
    return true;
  }

  return requestedCode === this.roomCode;
}

  onJoin(client: Client, options: any) {
  const player = new Player();

  const submittedName =
    typeof options?.playerName === "string"
      ? options.playerName.trim()
      : "";

  const submittedAnimal =
    typeof options?.selectedAnimal === "string"
      ? options.selectedAnimal.trim()
      : "";

  const validAnimals = [
    "elephant",
    "giraffe",
    "hippo",
    "monkey",
    "panda",
    "parrot",
    "penguin",
    "pig",
    "rabbit",
    "snake",
  ];

  player.name = (submittedName || `Player ${this.clients.length}`).slice(0, 16);
  player.animal = validAnimals.includes(submittedAnimal) ? submittedAnimal : "rabbit";

    const spawn =
    this.state.phase === "lobby" || this.state.phase === "finished"
      ? this.getLobbySpawnPosition()
      : this.getWorldSpawnPosition();

  player.x = spawn.x;
  player.y = spawn.y;
  player.score = 0;
  player.team = "";

  this.resetPlayerEffects(player);
  this.keepPlayerInBounds(player);

  this.state.players.set(client.sessionId, player);
  console.log(`${client.sessionId} joined as ${player.animal}`);

    if (this.state.gameMode === "teams") {
    const redCount = this.getTeamPlayerCount("red");
    const blueCount = this.getTeamPlayerCount("blue");
    player.team = redCount <= blueCount ? "red" : "blue";
  }

  if (!this.state.hostSessionId) {
    this.state.hostSessionId = client.sessionId;
  }

    client.send("room_code", {
    roomCode: this.roomCode,
  });
}

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    console.log(`${client.sessionId} left`);

    if (client.sessionId === this.state.hostSessionId) {
      const remainingClient = this.clients[0];
      this.state.hostSessionId = remainingClient ? remainingClient.sessionId : "";
    }

   
  }

    spawnPowerUp() {
    if (this.state.powerUps.size >= this.MAX_POWER_UPS) return;

    const id = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const type =
      this.POWER_UP_TYPES[
        Math.floor(Math.random() * this.POWER_UP_TYPES.length)
      ];

    console.log("SPAWNING POWER UP:", type);

    let spawnX = 0;
    let spawnY = 0;
    let foundSpot = false;

    for (let attempt = 0; attempt < 12; attempt++) {
      const spawn = this.getPowerUpSpawnPosition();

      if (this.isPowerUpSpawnClear(spawn.x, spawn.y, 220)) {
        spawnX = spawn.x;
        spawnY = spawn.y;
        foundSpot = true;
        break;
      }
    }

    if (!foundSpot) {
      const fallback = this.getPowerUpSpawnPosition();
      spawnX = fallback.x;
      spawnY = fallback.y;
    }

    const powerUp = new PowerUp();
    powerUp.id = id;
    powerUp.type = type;
    powerUp.x = spawnX;
    powerUp.y = spawnY;

    this.state.powerUps.set(id, powerUp);
  }

  checkPowerUpPickups() {
    const toRemove = new Set<string>();

    this.state.players.forEach((player: Player) => {
      this.state.powerUps.forEach((powerUp: PowerUp, id: string) => {
        if (toRemove.has(id)) return;

        const dx = player.x - powerUp.x;
        const dy = player.y - powerUp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.POWER_UP_RADIUS) {
          player.powerUpsCollected += 1;
          this.applyPowerUp(player, powerUp.type);
          toRemove.add(id);
        }
      });
    });

    toRemove.forEach((id) => this.state.powerUps.delete(id));
  }

    applyPowerUp(player: Player, type: string) {
    const now = Date.now();
    const isTeams = this.state.gameMode === "teams";

    if (type === "speed") {
      if (isTeams && player.team !== "") {
        this.getTeammates(player).forEach((teammate) => {
          teammate.speedActive = true;
          teammate.speedUntil = now + 5000;
        });
      } else {
        player.speedActive = true;
        player.speedUntil = now + 5000;
      }
    }

    if (type === "shield") {
      if (isTeams && player.team !== "") {
        this.getTeammates(player).forEach((teammate) => {
          teammate.shieldActive = true;
          teammate.shieldUntil = now + 5000;
        });
      } else {
        player.shieldActive = true;
        player.shieldUntil = now + 5000;
      }
    }

    if (type === "double") {
      if (isTeams && player.team !== "") {
        this.getTeammates(player).forEach((teammate) => {
          teammate.doublePointsActive = true;
          teammate.doublePointsUntil = now + 8000;
        });
      } else {
        player.doublePointsActive = true;
        player.doublePointsUntil = now + 8000;
      }
    }

    if (type === "magnet") {
      // keep magnet individual in both FFA and Teams
      player.magnetActive = true;
      player.magnetUntil = now + 6000;
      player.magnetTargetSessionId = "";
    }

    if (type === "invisible") {
      if (isTeams && player.team !== "") {
        this.getTeammates(player).forEach((teammate) => {
          teammate.invisibleActive = true;
          teammate.invisibleUntil = now + 10000;
        });
      } else {
        player.invisibleActive = true;
        player.invisibleUntil = now + 10000;
      }
    }

    if (type === "freeze") {
      if (isTeams && player.team !== "") {
        this.getOpponents(player).forEach((opponent) => {
          opponent.frozenActive = true;
          opponent.frozenUntil = now + 3000;
        });
      } else {
        this.state.players.forEach((other: Player) => {
          if (other === player) return;

          other.frozenActive = true;
          other.frozenUntil = now + 3000;
        });
      }
    }
  }

  updatePowerUpEffects() {
    const now = Date.now();

    this.state.players.forEach((player: Player) => {
      if (player.speedActive && now > player.speedUntil) {
        player.speedActive = false;
        player.speedUntil = 0;
      }

      if (player.shieldActive && now > player.shieldUntil) {
        player.shieldActive = false;
        player.shieldUntil = 0;
      }

      if (player.doublePointsActive && now > player.doublePointsUntil) {
        player.doublePointsActive = false;
        player.doublePointsUntil = 0;
      }

      if (player.magnetActive && now > player.magnetUntil) {
        if (player.magnetTargetSessionId) {
          const target = this.state.players.get(player.magnetTargetSessionId);
          if (target) {
            target.magnetLocked = false;
            target.magnetLockedUntil = 0;
          }
        }

        player.magnetActive = false;
        player.magnetUntil = 0;
        player.magnetTargetSessionId = "";
      }

      if (player.magnetLocked && now > player.magnetLockedUntil) {
        player.magnetLocked = false;
        player.magnetLockedUntil = 0;
      }

      if (player.invisibleActive && now > player.invisibleUntil) {
        player.invisibleActive = false;
        player.invisibleUntil = 0;
      }

      if (player.frozenActive && now > player.frozenUntil) {
        player.frozenActive = false;
        player.frozenUntil = 0;
      }

      if (!player.magnetActive) {
        player.magnetTargetSessionId = "";
      }
    });
  }

  assignTeams() {
  let assignRed = true;

  this.state.players.forEach((player: Player) => {
    if (this.state.gameMode === "teams") {
      player.team = assignRed ? "red" : "blue";
      assignRed = !assignRed;
    } else {
      player.team = "";
    }
  });
}

  applyMagnetEffects(deltaTime: number) {
  const entries: { sessionId: string; player: Player }[] = [];

  this.state.players.forEach((player: Player, sessionId: string) => {
    entries.push({ sessionId, player });
  });

  // First clear stale locks from players who are no longer a target
  for (const entry of entries) {
    const player = entry.player;
    if (!player.magnetLocked) continue;

    let stillTargeted = false;

    for (const source of entries) {
      if (
        source.player.magnetActive &&
        source.player.magnetTargetSessionId === entry.sessionId
      ) {
        stillTargeted = true;
        break;
      }
    }

    if (!stillTargeted && Date.now() > player.magnetLockedUntil) {
      player.magnetLocked = false;
      player.magnetLockedUntil = 0;
    }
  }

  for (const source of entries) {
    const magnetPlayer = source.player;
    if (!magnetPlayer.magnetActive) continue;

    let closestSessionId = "";
    let closestDistance = Number.MAX_VALUE;
    let closestTarget: Player | null = null;

    for (const target of entries) {
      if (target.sessionId === source.sessionId) continue;
      if (target.player.invisibleActive) continue;

      if (
        this.state.gameMode === "teams" &&
        magnetPlayer.team !== "" &&
        magnetPlayer.team === target.player.team
      ) {
        continue;
      }

      const dx = magnetPlayer.x - target.player.x;
      const dy = magnetPlayer.y - target.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= 0) continue;

      if (dist < closestDistance) {
        closestDistance = dist;
        closestSessionId = target.sessionId;
        closestTarget = target.player;
      }
    }

    magnetPlayer.magnetTargetSessionId = closestSessionId;

    if (!closestTarget) continue;

    // Lock target so they cannot resist with input
    closestTarget.magnetLocked = true;
    closestTarget.magnetLockedUntil = magnetPlayer.magnetUntil;

    const dx = magnetPlayer.x - closestTarget.x;
    const dy = magnetPlayer.y - closestTarget.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1) continue;

    const safeStopDistance = this.playerSize * 0.9;

    if (dist <= safeStopDistance) {
      continue;
    }

    const dirX = dx / dist;
    const dirY = dy / dist;

    // Strong but smooth server-side pull
    const pullSpeed = 520; // tuneable
    const maxStep = pullSpeed * (deltaTime / 1000);
    const moveAmount = Math.min(maxStep, dist - safeStopDistance);

    closestTarget.x += dirX * moveAmount;
    closestTarget.y += dirY * moveAmount;

    this.keepPlayerInBounds(closestTarget);
  }
}

  resetPlayerEffects(player: Player) {
    player.shieldActive = false;
    player.speedActive = false;
    player.doublePointsActive = false;
    player.magnetActive = false;
    player.invisibleActive = false;
    player.frozenActive = false;

    player.magnetLocked = false;
    

    player.shieldUntil = 0;
    player.speedUntil = 0;
    player.doublePointsUntil = 0;
    player.magnetUntil = 0;
    player.invisibleUntil = 0;
    player.frozenUntil = 0;
    player.magnetLockedUntil = 0;

    player.magnetTargetSessionId = "";
  }

  resetPlayerStats(player: Player) {
    player.correctAnswers = 0;
    player.totalAnswers = 0;
    player.currentStreak = 0;
    player.longestStreak = 0;
    player.stealsMade = 0;
    player.powerUpsCollected = 0;
  }

    getTeammates(source: Player): Player[] {
    const teammates: Player[] = [];

    this.state.players.forEach((player: Player) => {
      if (this.state.gameMode === "teams" && source.team !== "" && player.team === source.team) {
        teammates.push(player);
      }
    });

    return teammates;
  }

  getOpponents(source: Player): Player[] {
    const opponents: Player[] = [];

    this.state.players.forEach((player: Player) => {
      if (this.state.gameMode === "teams" && source.team !== "" && player.team !== "" && player.team !== source.team) {
        opponents.push(player);
      }
    });

    return opponents;
  }

      getTeamPlayerCount(team: string): number {
    let count = 0;

    this.state.players.forEach((player: Player) => {
      if (player.team === team) {
        count += 1;
      }
    });

    return count;
  }


    getTeamScore(team: string): number {
    let total = 0;

    this.state.players.forEach((player: Player) => {
      if (player.team === team) {
        total += player.score;
      }
    });

    return total;
  }

  getHighestScoringPlayerOnTeam(team: string): Player | null {
    let best: Player | null = null;
    let bestScore = -1;

    this.state.players.forEach((player: Player) => {
      if (player.team !== team) return;
      if (player.score <= 0) return;

      if (player.score > bestScore) {
        best = player;
        bestScore = player.score;
      }
    });

    return best;
  }

  readonly lobbyWidth = 800;
  readonly lobbyHeight = 600;  
  
  readonly worldWidth = 2000;
  readonly worldHeight = 2000;

    getPowerUpSpawnPosition() {
    const margin = 140;

    return {
      x: margin + Math.floor(Math.random() * (this.worldWidth - margin * 2)),
      y: margin + Math.floor(Math.random() * (this.worldHeight - margin * 2)),
    };
  }

    isPowerUpSpawnClear(x: number, y: number, minDistance = 220) {
    let clear = true;

    this.state.powerUps.forEach((powerUp: PowerUp) => {
      const dx = powerUp.x - x;
      const dy = powerUp.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDistance) {
        clear = false;
      }
    });

    return clear;
  }

    getLobbySpawnPosition() {
    return {
      x: 120 + Math.floor(Math.random() * 560),
      y: 120 + Math.floor(Math.random() * 360),
    };
  }

  getWorldSpawnPosition() {
  const margin = 160;

  return {
    x: Math.round(
      margin + Math.random() * (this.worldWidth - margin * 2)
    ),
    y: Math.round(
      margin + Math.random() * (this.worldHeight - margin * 2)
    ),
  };
}

  isSpawnFarEnough(
  x: number,
  y: number,
  used: { x: number; y: number }[],
  minDistance: number
) {
  for (const pos of used) {
    const dx = pos.x - x;
    const dy = pos.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < minDistance) return false;
  }

  return true;
}

    keepPlayerInBounds(player: Player) {
    const half = this.playerSize / 2;

    const useLobbyBounds =
      this.state.phase === "lobby" || this.state.phase === "finished";

    const maxWidth = useLobbyBounds ? this.lobbyWidth : this.worldWidth;
    const maxHeight = useLobbyBounds ? this.lobbyHeight : this.worldHeight;

    player.x = Math.max(half, Math.min(maxWidth - half, player.x));
    player.y = Math.max(half, Math.min(maxHeight - half, player.y));
  }

    resetPlayersForNewRound() {
  const used: { x: number; y: number }[] = [];
  const playerCount = this.state.players.size;
  const minDistance = playerCount <= 8 ? 320 : playerCount <= 16 ? 240 : 180;

  this.state.players.forEach((player: Player) => {
    let spawn = this.getWorldSpawnPosition();
    let found = false;

    for (let attempt = 0; attempt < 40; attempt++) {
      const candidate = this.getWorldSpawnPosition();

      if (this.isSpawnFarEnough(candidate.x, candidate.y, used, minDistance)) {
        spawn = candidate;
        found = true;
        break;
      }
    }

    if (!found) {
      spawn = this.getWorldSpawnPosition();
    }

    player.x = spawn.x;
    player.y = spawn.y;
    this.keepPlayerInBounds(player);

    used.push({ x: player.x, y: player.y });
  });
}

  startLobbyCountdown(durationSeconds: number) {
    this.clearStealInterval();

    this.state.phase = "countdown";
    this.state.gameStarted = false;
    this.state.durationSeconds = durationSeconds;
    this.state.countdownSeconds = 3;
    this.state.countdownStartTimestamp = Date.now();
    this.state.startTimestamp = 0;
    this.state.winnerScore = 0;
    this.state.powerUps.clear();
    this.state.scoreTokens.clear();
    this.powerUpSpawnElapsed = 0;

    this.broadcast("countdown_beep", { number: 3 });

    this.clock.setTimeout(() => {
      if (this.state.phase === "countdown") {
        this.broadcast("countdown_beep", { number: 2 });
      }
    }, 1000);

    this.clock.setTimeout(() => {
      if (this.state.phase === "countdown") {
        this.broadcast("countdown_beep", { number: 1 });
      }
    }, 2000);

            this.state.players.forEach((player: Player) => {
      player.score = 0;
      this.resetPlayerEffects(player);
      this.resetPlayerStats(player);

      if (this.state.gameMode !== "teams") {
        player.team = "";
      }
    });

    this.resetPlayersForNewRound();
    if (this.state.gameMode === "teams") {
      let hasAnyAssignedTeam = false;

      this.state.players.forEach((player: Player) => {
        if (player.team === "red" || player.team === "blue") {
          hasAnyAssignedTeam = true;
        }
      });

      if (!hasAnyAssignedTeam) {
        this.assignTeams();
      }
    }

    this.clock.setTimeout(() => {
      this.state.phase = "in_game";
      this.state.gameStarted = true;
      this.state.startTimestamp = Date.now();

      this.startStealInterval();

      this.clock.setTimeout(() => {
        this.endGame();
      }, this.state.durationSeconds * 1000);
    }, this.state.countdownSeconds * 1000);
  }

  returnToLobby() {
    this.clearStealInterval();

    this.state.phase = "lobby";
    this.state.gameStarted = false;
    this.state.startTimestamp = 0;
    this.state.countdownStartTimestamp = 0;
    this.state.winnerScore = 0;
    this.state.powerUps.clear();
    this.state.scoreTokens.clear();
    this.powerUpSpawnElapsed = 0;

      this.state.players.forEach((player: Player) => {
      player.score = 0;

      if (this.state.gameMode !== "teams") {
        player.team = "";
      }

      this.resetPlayerEffects(player);
      this.resetPlayerStats(player);
      this.keepPlayerInBounds(player);
    });
  }

  endGame() {
    this.clearStealInterval();

    this.state.phase = "finished";
    this.state.gameStarted = false;
    this.state.powerUps.clear();
    this.state.scoreTokens.clear();
    this.powerUpSpawnElapsed = 0;

    let topScore = 0;
    this.state.players.forEach((player: Player) => {
      if (player.score > topScore) {
        topScore = player.score;
      }
      this.resetPlayerEffects(player);
      this.keepPlayerInBounds(player);
    });

    this.state.winnerScore = topScore;
  }

  startStealInterval() {
    this.clearStealInterval();

    this.stealInterval = this.clock.setInterval(() => {
      this.processStealing();
    }, 500);
  }

  clearStealInterval() {
    if (this.stealInterval) {
      this.stealInterval.clear();
      this.stealInterval = null;
    }
  }

  playersOverlap(a: Player, b: Player): boolean {
    const halfSize = this.playerSize / 2;

    return (
      Math.abs(a.x - b.x) < halfSize * 2 &&
      Math.abs(a.y - b.y) < halfSize * 2
    );
  }

    processStealing() {
  if (this.state.phase !== "in_game") return;

  const entries: { sessionId: string; player: Player }[] = [];

  this.state.players.forEach((player: Player, sessionId: string) => {
    entries.push({ sessionId, player });
  });

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const playerA = entries[i].player;
      const playerB = entries[j].player;

      if (!this.playersOverlap(playerA, playerB)) continue;

      // ===== TEAMS MODE =====
      if (this.state.gameMode === "teams") {
        // Both players must have valid teams
        if (
          playerA.team === "" ||
          playerB.team === ""
        ) {
          continue;
        }

        // Same team can never steal from each other
        if (playerA.team === playerB.team) {
          continue;
        }

        const teamAScore = this.getTeamScore(playerA.team);
        const teamBScore = this.getTeamScore(playerB.team);

        // No stealing if teams are tied
        if (teamAScore === teamBScore) {
          continue;
        }

        let stealer: Player;
        let contactedOpponent: Player;

        // The player from the LOWER scoring team steals
        if (teamAScore < teamBScore) {
          stealer = playerA;
          contactedOpponent = playerB;
        } else {
          stealer = playerB;
          contactedOpponent = playerA;
        }

        let victim: Player | null = null;

        // If the contacted opponent has points, steal directly from them
        if (contactedOpponent.score > 0) {
          victim = contactedOpponent;
        } else {
          // Otherwise steal from the top scorer on that opponent team
          victim = this.getHighestScoringPlayerOnTeam(contactedOpponent.team);
        }

        if (!victim) continue;
        if (victim.score <= 0) continue;
        if (victim.shieldActive) continue;
        if (victim.invisibleActive) continue;

        stealer.score += 1;
        victim.score -= 1;
        stealer.stealsMade += 1;

        continue;
      }

      // ===== FFA MODE ONLY =====
      if (playerA.score === playerB.score) continue;

      let poorer: Player;
      let richer: Player;

      if (playerA.score < playerB.score) {
        poorer = playerA;
        richer = playerB;
      } else {
        poorer = playerB;
        richer = playerA;
      }

      if (poorer.score < richer.score && richer.score > 0) {
        if (richer.shieldActive) continue;
        if (richer.invisibleActive) continue;

        poorer.score += 1;
        richer.score -= 1;
        poorer.stealsMade += 1;
      }
    }
  }
}
}