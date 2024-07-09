import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import * as dotenv from "dotenv";
import { createServer } from "http";
import Room from "./utils/room.js";

const app = express();
dotenv.config();
const isDev = app.settings.env === "development";
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

let rooms = new Map();

const words = [
  ["pen", "car", "pencil"],
  ["scooty", "camera", "computer"],
];

function hintAlgo(hintArray) {
  let index = Math.floor(Math.random() * hintArray.length);
  while (hintArray[index] != 0) {
    index = Math.floor(Math.random() * hintArray.length);
  }
  return index;
}

function triggerDraw(roomId, socket, io, selectedWord) {
  const roomInstance = rooms.get(roomId);

  clearInterval(roomInstance.timers.timerId);

  roomInstance.status.mode = "draw";

  roomInstance.timers.timerLimit = 60;
  /** Generate Hint */
  roomInstance.currentWord.current = selectedWord;

  roomInstance.currentWord.hint = new Array(selectedWord.length).fill(0);
  let hint = "";
  let hintMultiple = 60 / roomInstance.currentWord.current.length;

  /**Trigger Draw */
  /** notify audience - user is drawing word*/
  Object.keys(roomInstance.participant).forEach((user) => {
    if (roomInstance.participant[user].role === "audience") {
      io.to(user).emit("notify", {
        status: "drawing",
        data: roomInstance.drawing,
        mssg: `${
          roomInstance.participant[roomInstance.currentUser].name
        } is drawing`,
      });
    }
  });

  /** notify performer to draw word */
  io.to(roomInstance.currentUser).emit("notify", {
    status: "draw",
    data: roomInstance.currentWord.current,
    mssg: `${
      roomInstance.participant[roomInstance.currentUser].name
    } draw word is ${roomInstance.currentWord.current}`,
  });

  roomInstance.timers.timerId = setInterval(() => {
    if (roomInstance.timers.timerLimit > 0) {
      if ((roomInstance.timers.timerLimit - 1) % hintMultiple == 0) {
        hint = generateHint(roomInstance);
      }

      io.to(roomId).emit("timer", {
        timerRunning: true,
        time: roomInstance.timers.timerLimit,
      });

      Object.keys(roomInstance.participant).forEach((user) => {
        if (roomInstance.participant[user].role === "audience") {
          io.to(user).emit("notify", {
            status: "hint",
            data: hint,
          });
        }
      });

      // io.to(roomId).emit("countdown", {
      //   status: "draw",
      //   hint: hint,
      //   time: roomInstance.timers.timerLimit,
      // });
      roomInstance.timers.timerLimit--;
    } else {
      clearInterval(roomInstance.timers.timerId);

      io.to(roomId).emit("timer", {
        timerRunning: false,
        time: 0,
      });

      // io.to(roomInstance.currentUser).emit("draw-end", {
      //   status: "draw",
      //   hint: hint,
      //   time: roomInstance.timers.timerLimit,
      // });
      triggerWait(roomId, socket, io);
    }
  }, 1000);
}

function generateString(length) {
  const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for ( let i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function generateHint(roomInstance) {
  let index = hintAlgo(roomInstance.currentWord.hint);
  roomInstance.currentWord.hint[index] = 1;
  let hint = "";
  roomInstance.currentWord.hint.forEach((data, index) => {
    if (data === 1) {
      hint = hint + roomInstance.currentWord.current[index];
      roomInstance.currentWord.hint[index] = 1;
    } else hint += "_";
  });
  return hint;
}

function triggerWait(roomId, socket, io) {
  /**check if round has ended */

  const roomInstance = rooms.get(roomId); 
  clearInterval(roomInstance.timers.timerId);
  roomInstance.status.mode = "wait";
  roomInstance.updateRound();
  if (roomInstance.rounds.current > roomInstance.rounds.total) {
    triggerEnd(roomId, socket, io);
  } else {
    io.to(roomId).emit("notify", {
      status: "wait",
      data: [],
      mssg: "",
    });

    roomInstance.timers.timerId = setTimeout(() => {
      triggerSelect(roomId, socket, io);
    }, 5000);

    /***yes */

    /***No */
  }
}

function triggerSelect(roomId, socket, io) {
  const roomInstance = rooms.get(roomId);
  clearInterval(roomInstance.timers.timerId);
  roomInstance.drawing = [];
  roomInstance.status.mode = "select";
  const { wordList } = roomInstance.updateToSelectStatus(); 

  /** notify audience - user is selecting word*/
  Object.keys(roomInstance.participant).forEach((user) => {
    if (roomInstance.participant[user].role === "audience") {
      io.to(user).emit("notify", {
        status: "selecting",
        mssg: `${
          roomInstance.participant[roomInstance.currentUser].name
        } is selecting the word`,
        currentRound: roomInstance.rounds.current,
      });
    }
  });

  /** notify performer to select word */
  io.to(roomInstance.currentUser).emit("notify", {
    status: "select",
    data: wordList,
    mssg: `${
      roomInstance.participant[roomInstance.currentUser].name
    } select one word`,
    currentRound: roomInstance.rounds.current,
  });

  /** Send select timer event */
  roomInstance.timers.timerId = setInterval(() => {
    if (roomInstance.timers.timerLimit > 0) {
      io.to(roomId).emit("timer", {
        timerRunning: true,
        time: roomInstance.timers.timerLimit,
      });
      roomInstance.timers.timerLimit--;
    } else {
      clearInterval(roomInstance.timers.timerId);

      io.to(roomId).emit("timer", {
        timerRunning: false,
        time: 0,
      });

      triggerDraw(
        roomId,
        socket,
        io,
        wordList[Math.floor(Math.random() * wordList.length)]
      );
    }
  }, 1000);
}

function triggerEnd(roomId, socket, io) {
  const roomInstance = rooms.get(roomId);
  roomInstance.status.mode = "end";
  clearInterval(roomInstance.timers.timerId);
  io.to(roomId).emit("notify", {
    status: "end",
    data: [],
    mssg: "",
  });
}

function updateScore(roomId, socket, io) {      
  const roomInstance = rooms.get(roomId);
  roomInstance.participant[socket.id].score +=
    roomInstance.timers.timerLimit * 100;
  roomInstance.participant[socket.id].guess = true;
  updatePlayer(roomId, socket, io);
  /**check if all player has guess the word */
}

function updatePlayer(roomId, socket, io) {
  const roomInstance = rooms.get(roomId);
  io.to(roomId).emit("player-info", {
    data: roomInstance.participant, 
  });
}

io.on("connection", (socket) => {

  socket.on("join", ({ roomId, name, avatar }) => {
    if (rooms.has(roomId)) {   
      socket.join(roomId);
      const roomInstance = rooms.get(roomId);
      roomInstance.addParticipant(socket.id, name, avatar);
      socket.emit("joined", { msg: "joined", roomId: roomId });
    } else {
      socket.emit("join-error", { msg: "Server error" });
    }
  }); 

  socket.on("create-room", ({ name, avatar }) => {
    let roomId = generateString(6);
    while (rooms.has(roomId)){ 
      roomId = generateString(6);
    } 
      socket.join(roomId);
      console.log(name, roomId,"-------------------");
      const roomInstance = new Room(socket.id, name, words, avatar);
      rooms.set(roomId, roomInstance);
      socket.emit("joined", { msg: "joined", roomId: roomId });
    // } else {
    //   socket.emit("join-error", { msg: "Server error" });
    // }
  }); 

  socket.on("in-game", ({ roomId }) => {
    console.log(roomId,rooms);  
    const roomInstance = rooms.get(roomId); 

    updatePlayer(roomId, socket, io);
    const config = {
      ready: roomInstance.admin == socket.id ? false : true,
      canvas: false, 
      gameStart: roomInstance.status.mode == "ready" ? false : true,
      totalRound: roomInstance.rounds.total,
    };
    socket.emit("notify", { config: config, status: "ready" });  
    io.sockets.in(roomId).emit("play", { sound: "join" });
    /**if game not started (ready) */
    switch (roomInstance.status.mode) {
      case "ready":   
        {
          break;
        }
      case "select":
        {
          socket.emit("notify", {
            status: "selecting",
            mssg: `${roomInstance.participant[user].name} is selecting the word`,
          });
          break;
        }
      case "draw": {
        console.log(roomInstance);
        /**sent current draw */
        socket.emit("notify", {
          status: "drawing",
          data: roomInstance.drawing,
          mssg: `${
            roomInstance.participant[roomInstance.currentUser].name
          } is drawing`,
        });
        break;
      }
      case "wait": {
        /**sent wait screen data */
        socket.emit("notify", {
          status: "wait",
          data: [],
          mssg: "",
        });
        break;
      }
      case "end": {
        /**send end screen data */
        break;
      } 
      default:
        break;
    }
  });

  socket.on("start-game", ({ roomId }) => {
    const roomInstance = rooms.get(roomId);
    const checkJoin = roomInstance.startGame(); 
    if (checkJoin.flag) {        
      roomInstance.updateRound();     
      triggerSelect(roomId, socket, io);
    } else {
      io.to(roomId).emit("notify", {
        status: "start-error",
        mssg: "Need Atleast 2 players to start the game",
      });
    }
  });

  socket.on("selected", ({ roomId, selectedWord }) => {
    triggerDraw(roomId, socket, io, selectedWord);
  }); 

  socket.on("performer-drawing", ({ roomId, drawArray }) => {
    /**Trigger Draw */
    const roomInstance = rooms.get(roomId);
    roomInstance.drawing = drawArray;
    /** performer is selecting word event to audience */
    socket.to(roomId).emit("notify", {
      status: "perform-draw",
      data: drawArray,
    });
  });

  socket.on("chat", ({ roomId, guess }) => {
    const roomInstance = rooms.get(roomId);
    /**check if current status is draw */
    if (
      roomInstance.status.mode == "draw" &&
      roomInstance.currentUser != socket.id
    ) {
      /**check if user guessed right word */
      if (roomInstance.currentWord.current == guess) {
        /**update chat green to sender*/
        socket.emit("send-chat", {
          name:roomInstance.participant[socket.id].name,
          data: guess,
          color: true,
        });
        io.to(roomInstance.currentUser).emit("send-chat", {
          name:roomInstance.participant[socket.id].name,
          data: guess,
          color: true,
        });

        /**update player Score */
        updateScore(roomId, socket, io);
      } else {
        io.to(roomId).emit("send-chat", {
          name:roomInstance.participant[socket.id].name,
          data: guess,
          color: false,
        });
      }
      /**normal chat */
    } else if (roomInstance.currentUser != socket.id) {
      /**normal chat */
      io.to(roomId).emit("send-chat", {
        name:roomInstance.participant[socket.id].name,      
        data: guess,   
        color: false,
      });
    } else {
    }
  });

  socket.on("disconnect", () => {
    /**update user list */
    /**update gsme status */
  });
});

httpServer.listen(5000, () => console.log("Started"));
