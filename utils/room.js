export default class Room {
  constructor(socketId, name, wordList, avatar) {
    this.participant = {};
    Object.defineProperty(this.participant, socketId, {
      value: {
        name: name,
        score: 0,
        role: 'audience', /** performer | audience */
        present: true,
        guess: false,
        avatar: avatar
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });
    this.admin = socketId;
    this.currentUser = null;
    this.status = {
      mode: "ready" /** 'ready' | 'select' | 'draw' | 'wait' | 'end' */,
      mssg: null,
    };
    this.drawing = [];
    this.limit = {
      total: 8,           
      current: 1,          
    };
    this.timers = {
      timerId: null,
      timerLimit: 0,
    };
    this.rounds = {
      current: 0,
      total: 3,
    };
    this.wordList = wordList;
    this.currentWord = {
        current: null,
        hint: null,
    };
  }

  addParticipant(socketId, name, avatar) {
    console.log('Word List',this.wordList);
    if (this.limit.current > this.limit.total)
      return { mssg: "Maximum room limit reached" };
    Object.defineProperty(this.participant, socketId, {
      value: {
        name: name,
        score: 0,
        role: 'audience',
        present: true,
        guess: true,
        avatar: avatar 
      },
      writable: true,
      enumerable: true,
      configurable: true, 
    });

    this.limit.current = this.limit.current + 1;

    console.log('Word List',this.wordList);

    return { mssg: "New Participant Added" };
  }

  startGame() {
    console.log('--start--');
    if(Object.keys(this.participant).length < 2)
        return { flag: false, mssg: "Need Atleast 2 players to start the game" };
    return { flag: true };
  }
 
  updateToSelectStatus() {
    this.status.mode = 'select';

    /**Randomly pick 3 words */
    const wordList = this.wordList[Math.floor(Math.random() * this.wordList.length)];



    return {wordList};
  }


  updateRound() {
    
    const playerList = Object.keys(this.participant);

    // let previousUser = playerList[0];
    let index = -1;

    playerList.forEach((key,i) => {
      if(this.participant[key].role == 'performer'){
        index = i;
      }
        this.participant[key].role = 'audience';
    });

    // if(this.currentUser !== null){
    //     for(let i = 1; i< playerList.length; i++){
    //         if(previousUser === this.currentUser)
    //             {
    //                 if(i === playerList.length-1){
    //                     index = 0;
    //                     this.rounds.current++;
    //                     console.log("************************************************************************************************************");
    //                     // if(this.rounds.current > this.rounds.total){
                          
    //                     // }
    //                     break;
    //                 }else{
    //                     index = i;
    //                     console.log("************************************-------------------************************************************************************");
    //                     break;
    //                 }
    //             }
    //     }
    // }


if(index === playerList.length-1){
  index = 0;
}else{
  index = index + 1;
}

if(index == 0){
  this.rounds.current=this.rounds.current + 1;
}

console.log("update round ---------------> ",index,playerList[index], this.participant);

    this.participant[playerList[index]].role = 'performer';
    this.currentUser = playerList[index];
    this.timers.timerLimit = 5;

    return { currentUser: this.participant[playerList[index]]};
  }

  updatetoDrawStatus() {}

  updatetoWaitStatus() {}

  updatetoEndStatus() {}

  leaveRoom() {}
}
 

