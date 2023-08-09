//https://streamlabs.com/dashboard#/settings/api-settings
const socketToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0b2tlbiI6IjZEODNFRkRENUUzRjNGMTRCMzMyIiwicmVhZF9vbmx5Ijp0cnVlLCJwcmV2ZW50X21hc3RlciI6dHJ1ZSwieW91dHViZV9pZCI6IlVDTE5aSVZic2xTZGxEUGRmNk4ydUdsQSJ9.jp0mNWDTAcqhSECMTtAya1hHlVS-ULoAgPy4wTdGpAw"

var wsUrl = "ws://localhost:11111/";
function creatWebSocket() {
    window.ws = new WebSocket(wsUrl);

    ws.onclose = function () {
        document.getElementById("sp").style.opacity = 1;
        console.log("faild live count ws connection - retry in 2s")
        setTimeout(creatWebSocket, 2000);
    }

    ws.onopen = function () {
        document.getElementById("sp").style.opacity = 0;
        console.log("livecount ws connected!");
    };

    ws.onmessage = function (e) {
        const data = JSON.parse(e.data);
        if (data.error)
            return console.warn(data.error);
        if (data.SubCount)
            return App.OnUpdate(data.SubCount);
    }
}
creatWebSocket();


const streamlabs = io(`https://sockets.streamlabs.com?token=${socketToken}`, { transports: ['websocket'] });
streamlabs.on("connect", () => { document.getElementById("sl").style.opacity = 0; })
streamlabs.on("disconnect", () => { document.getElementById("sl").style.opacity = 1; });
//Perform Action on event
streamlabs.on('event', (eventData) => {
    console.log(eventData)
    if (!eventData.for && eventData.type === 'donation') {
        App.donationSum += Number(eventData.message[0].amount);
        App.animate(true);
    } else if (eventData.for && eventData.type === "subscription") {
        const memberLevelName = eventData.message[0].membershipLevelName;
        const memberVal = App.members[memberLevelName];
        if (memberVal) {
            App.donationSum += memberVal / App.timePerDollar;
            App.animate(true);
        }
    }
});



const App = {
    //{ "type": "subscription", "message": [ { "priority": 10, "_id": "62c9c8bf2644c", "from": "יונתן נרקיס", "from_display_name": null, "emotes": null, "months": 1, "streak_months": null, "message": "", "payload": [], "name": "יונתן נרקיס", "display_name": null, "subPlan": "1000", "sub_plan": "1000", "subscriber_twitch_id": null, "gifter": "", "gifter_display_name": null, "count": 1, "repeat": true, "isTest": false, "createdAt": "2022-07-09 18:28:15", "platform": "youtube_account", "planName": "", "type": "subscription", "sub_type": null, "hash": "subscription:יונתן נרקיס:", "read": false, "amount": null, "membershipLevel": 1, "membershipLevelName": null, "membershipGift": null, "membershipGiftMessageId": null, "massSubGiftChildAlerts": [], "isSubgiftExpanded": true, "benefit_end_month": null, "historical": true, "forceShow": false, "success": false, "forceRepeat": false } ], "for": "youtube_account", "event_id": "evt_09f8920f49eccb2d4e198728124fde33" }
    minTime: 60,
    timePerDollar: 3,
    timePerSub: 0.5,
    members: {},
    donationSum: 0,
    startCount: null,
    currentCount: null,
    startDate: null,
    timerEnd: 0,
    pointer: null,
    setUp: function (count) {
        if (this.pointer)
            return;

        this.pointer = document.getElementById("counter")

        if (Number(new Date(localStorage.seen || 0)) < Number(new Date()) - 5 * 60 * 1000)
            localStorage.clear();

        //set up data from memory (in case of a refresh)
        this.startCount = count;
        this.startDate = new Date();
        if (localStorage.cached_date) {
            this.startDate = new Date(localStorage.cached_date);
            this.donationSum = Number(localStorage.donationSum) || this.donationSum;
            this.startCount = Number(localStorage.startCount) || this.startCount;
        }

        localStorage.cached_date = this.startDate;
        localStorage.startCount = this.startCount;

        this.LoadUrlVars();

        this.interval(); //run first update
        setInterval(App.interval.bind(App), 1000); //update every sec
    },

    Reset() {
        localStorage.clear();
        window.location.reload();
    },

    LoadUrlVars() {
        const url = new URL(window.location.href);
        const q = url.searchParams;

        this.minTime = Number(url.searchParams.get("minTime")) || this.minTime;
        this.timePerDollar = Number(url.searchParams.get("timePerDollar")) || this.timePerDollar;
        this.timePerSub = Number(url.searchParams.get("timePerSub")) || this.timePerSub;
        if (url.searchParams.get("members")) {
            try {
                this.members = JSON.parse(url.searchParams.get("members"))
            } catch (err) { }
        }

        window
            .history
            .pushState({}, '', `?minTime=${this.minTime}
    &timePerDollar=${this.timePerDollar}
    &timePerSub=${this.timePerSub}
    &members=${JSON.stringify(this.members)}`);

    },

    animate: function (isDonation = false) {
        if (isDonation) {
            localStorage.donationSum = this.donationSum;
            animateCSS(this.pointer, "heartBeat"); //donation animation
        } else {
            animateCSS(this.pointer, "pulse"); //sub animation
        }
    },
    OnUpdate: function (count) {
        if (!this.pointer)
            this.setUp(count);
        this.currentCount = count;
        App.animate();
    },

    interval: function () {
        localStorage.seen = new Date();

        const subDiff = Math.max(this.currentCount - this.startCount, 0);
        const endDate = new Date(this.startDate);

        let bonus = 0;
        if (App.donationSum >= 100)
            bonus = 60
        if (App.donationSum >= 200)
            bonus += 60;

        const newDateTime = endDate.getMinutes() + this.minTime +
            subDiff * App.timePerSub +
            this.donationSum * App.timePerDollar +
            bonus;
        endDate.setMinutes(newDateTime);
        endDate.setSeconds(endDate.getSeconds() + newDateTime % 1 * 60);

        const timeAdded = (Number(endDate) - this.timerEnd) / 1000;
        if (timeAdded > 0 && this.timerEnd != 0)
            Fly(format(timeAdded), "", this.pointer)

        const timeRemain = (endDate - new Date()) / 1000; //in sec
        if (timeRemain <= 0)
            this.startDate = 0;
        this.pointer.innerHTML = format(timeRemain);
        this.timerEnd = endDate;
    }
}

function format(time) {
    // Hours, minutes and seconds
    var hrs = ~~(time / 3600);
    var mins = ~~((time % 3600) / 60);
    var secs = ~~time % 60;

    // Output like "1:01" or "4:03:59" or "123:03:59"
    var ret = "";
    if (hrs > 0) {
        ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
    }
    ret += "" + mins + ":" + (secs < 10 ? "0" : "");
    ret += "" + secs;

    if (time <= 0)
        ret = "סוף הלייב!"
    return ret;
}

var flyStack = [];

function Fly(text, style, targetElement) {
    var pos = {};

    var newFly = document.createElement("fly");
    newFly.innerHTML = `<warp>${text}+</warp>`;

    pos.x = targetElement.offsetLeft + targetElement.offsetWidth / 3 * 2;
    pos.y = targetElement.offsetTop + targetElement.offsetHeight / 2 * 0;

    newFly.setAttribute("style", "top:" + pos.y + "px; left:" + pos.x + "px;" + style);
    document.body.appendChild(newFly)

    setTimeout(function () {
        newFly.remove();
    }, 200000);
}


const animateCSS = (element, animation, prefix = 'animate__') =>
    new Promise((resolve, reject) => {
        const animationName = `${prefix}${animation}`;
        const node = element;

        node.classList.add(`${prefix}animated`, animationName);

        function handleAnimationEnd(event) {
            event.stopPropagation();
            node.classList.remove(`${prefix}animated`, animationName);
            resolve('Animation ended');
        }

        node.addEventListener('animationend', handleAnimationEnd, { once: true });
    });