var userSettings = {
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
    }
}

class TimerApp {
    /** @type {Element} */
    #TimerContainer;
    /** @type {Element} */
    #AnimationContainer;
    /** @type {Number} */
    #updateInterval

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
        this.#ini()
    }

    set #html(html) {
        this.#TimerContainer.innerHTML = html;
    }

    get #duration() {
        const totalDuration = userSettings.baseDuration * 60 + //base duration
            this.subcount.addedDuration + //time from new subs
            this.donations.addedDuration;

        return (this.startTime - Date.now()) / 1000 + totalDuration
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
        if (timeRemain < 0)
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
        for (let i = this.#TimerContainer.childNodes.length;
            i < elements.length; i++) {
            this.#TimerContainer.appendChild(elements[i])
        }
    }

    async VisualAddTime(addedTime) {
        const fly = document.createElement("fly");
        fly.innerHTML = "<warp>" + format(addedTime) + " +</warp"
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
        // localStorage.clear() //clear stored data so next refresh will get new timer

        const statBools = userSettings.endStats;
        const statsHtml = []

        if (statBools.subs && this.subcount.gainedSubs)
            statsHtml.push(`<div>
                <span>רשומים חדשים:</span>
                <h1>${this.subcount.gainedSubs}</h1>
            </div>`);

        if (statBools.duration)
            statsHtml.push(`<div>
                <span>אורך הלייב:</span>
                <h1>${format((Date.now() - this.startTime) / 1000)}</h1>
            </div>`);

        if (statBools.donation && this.donations.donationSum)
            statsHtml.push(`<div>
                <span>תרומות בלייב:</span>
                <h1>${this.donations.donationSum}$</h1>
            </div>`);

        //TODO: add & handle members to timer
        if (statBools.members)
            statsHtml.push(`<div>
                <span>חברי מועדון</span>
                <h1>${0}</h1>
            </div>`);

        const statsDiv = document.createElement("div");
        statsDiv.className = "stats";
        statsDiv.innerHTML = statsHtml.join("")
        this.#TimerContainer.parentElement.appendChild(statsDiv);


        //console.log(timer.subcount.addedDuration, timer.subcount.gainedSubs)
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
    }

    /**
     * gets called for each new donation - adding donation & visual update
     * @param {Number} donationAmount 
     */
    addDonation(donationAmount) {
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
 * convert seconds into clock time string
 * @param {Number} time 
 * @returns {String}
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
var timer = new TimerApp("#counter");