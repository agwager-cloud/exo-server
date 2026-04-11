import cors from "cors";
import { defineServer, defineRoom } from "colyseus";
import { MyRoom } from "./rooms/MyRoom.js";

export default defineServer({
  rooms: {
    exo_room: defineRoom(MyRoom),
  },

  express: (app) => {
    app.use(cors());

    app.get("/", (_req, res) => {
      res.send("EXO server is running");
    });
  },
});